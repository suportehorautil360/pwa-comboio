# Spec — Offline First (PWA do Comboista / `my-app`)

> Auditoria e plano de arquitetura para tornar o `my-app` (Next.js 16 App Router,
> PWA do comboista) **verdadeiramente offline-first**: a ausência de internet não
> pode impedir a operação em campo.
>
> Status: **proposta** (auditoria concluída, implementação não iniciada).
> Stack: Next.js 16.2.7 · React 19 · Tailwind 4 · radix-ui · backend NestJS (`back-360-`, repo separado).

---

## 0. TL;DR

O app **não é** "sem nada de offline". Ele tem uma base parcial **boa para escritas**
(outbox em IndexedDB com idempotência + retry) e **quase nada para leituras**.

| Camada | Hoje | Veredito |
|---|---|---|
| **Escrita** (abastecer, engraxar, reabastecer, ponto) | Outbox IndexedDB + `Idempotency-Key` + retry 30s + flush no `online` | ✅ Funciona offline |
| **Leitura** (dashboard, meu-ponto, espelho, histórico, solicitações) | `api.get` direto no NestJS (cross-origin), **sem cache** | ❌ Quebra offline / em reload |
| **Login** | JWT em `localStorage`, `expiresIn` **descartado**, sem renovação | ⚠️ Abre offline só se shell em cache; sem controle de expiração |
| **Service Worker** | Network-first navigation + SWR same-origin, precache só de `/` | ⚠️ Assets do Next não são pré-cacheados; fallback errado p/ login |
| **Edições de ponto** (`editarHorario`, `solicitacoes`) | `api.post` **direto**, fora do outbox | ❌ Quebra offline e perde o dado |
| **Background Sync / Push / Periodic Sync** | Inexistente | ❌ Faltando |
| **Ícones PWA** | `/icon` 512 + `/apple-icon` 180 (rotas dinâmicas), sem 192 | ⚠️ Installability Android no limite |

**Decisão central:** as **leituras** migram para um cache local **Dexie** (read-through /
stale-while-revalidate na camada `lib/api`), as **escritas** continuam no outbox (migrado
para Dexie, com backoff + Background Sync), e o **Service Worker** passa a pré-cachear o
app-shell + assets do Next (Serwist) para garantir o boot offline.

---

## Status de implementação (atualizado 2026-06-16)

> Implementado nos commits `feat(offline)`/`feat(pwa)` na branch `fix/historico-endpoint`.

| Fase | Estado | Onde |
|---|---|---|
| **0 — Fundação** (Dexie + boot offline) | ✅ feito | [lib/db.ts](../lib/db.ts), [app/sw.ts](../app/sw.ts) (Serwist), [app/~offline](../app/~offline/page.tsx), prompt de update em [service-worker-register.tsx](../components/pwa/service-worker-register.tsx) |
| **1 — Outbox robusto** | ✅ feito | [lib/offline/outbox.ts](../lib/offline/outbox.ts) (backoff + dead-letter), edições de ponto pelo outbox, UI de erros em [sync-errors.tsx](../components/mobile/sync-errors.tsx), Background Sync |
| **2 — Leituras offline** | ✅ feito | [lib/data/](../lib/data/) (cache read-through + `useCached` + `queries.ts`); 8 telas migradas |
| **3 — Login/sessão offline** | ✅ feito | [lib/session.ts](../lib/session.ts): janela confiável 7d, `touchSession` (deslizante), expiração no `getSessionUser` |
| **4 — PWA production-ready** | ✅ parcial | ícones 192/512/maskable ([app/icon.tsx](../app/icon.tsx)), manifest com id/scope/lang/categories. Falta: splash iOS, push (opcional) |
| **5 — Sync incremental** | ⛔ bloqueado no back | tabela `meta` (cursores) pronta; precisa do contrato abaixo |

**Verificado:** `pnpm lint` + `pnpm test` (60 testes) + `pnpm build` (Serwist gera o SW). **Não** rodado: teste offline real em device (instalar → derrubar rede → recarregar) — ver checklist §10.

**Contrato pendente no `back-360-` para a Fase 5 (sync incremental):**
- GETs de lista aceitarem `?updatedSince=<ISO>` e devolverem só o delta.
- Cada registro com `updatedAt` (ISO) e, idealmente, `rev`/versão.
- `Idempotency-Key` também nas escritas migradas (`/time-records/update/:id`, `/solicitacoes-ponto`).
- Endpoint de refresh de token (`/funcionarios/auth/refresh`) para renovar o JWT sem novo login (hoje a janela confiável de 7d cobre o offline).

Enquanto isso, o pull faz **full-replace por entidade** (idempotente, correto; só mais pesado em 3G).

---

## 1. Diagnóstico do estado atual

### 1.1. O que JÁ existe e funciona

- **Outbox de escrita** — [lib/offline/outbox.ts](../lib/offline/outbox.ts)
  - IndexedDB puro (`hu360-comboio` → store `outbox`), `keyPath: "id"`.
  - `submit(kind, payload)`: tenta enviar online; em 4xx definitivo (≠409) **lança** (a tela mostra o erro); em 409/5xx/rede/offline **enfileira** e devolve `{ synced: false }`.
  - `flushOutbox()`: best-effort; envia pendentes com `Idempotency-Key` estável; em 4xx marca `failed`, em 5xx/rede **para** o loop.
  - `kinds`: `abastecimento | lubrificacao | reabastecimento | ponto`.
  - Pub/sub para a UI ([lib/offline/use-outbox.ts](../lib/offline/use-outbox.ts)): flush ao montar, no evento `online` e a cada **30s**.
- **Idempotência** — header `Idempotency-Key` por item ([lib/api/client.ts](../lib/api/client.ts)), estável entre reenvios → backend descarta duplicata. Excelente base anti-duplicação.
- **Sessão** persistida em `localStorage` ([lib/session.ts](../lib/session.ts)): `hu360_token`, `hu360_user`, `hu360_comboio`. Um usuário já logado **mantém identidade** offline.
- **Feature flags** com cache em `localStorage` ([lib/api/feature-flags.ts](../lib/api/feature-flags.ts)) — único read com fallback offline hoje.
- **Service Worker** ([public/sw.js](../public/sw.js)): navigation network-first → cache; SWR para GET same-origin (`_next`, ícones, RSC); cross-origin (API) passa direto (correto — quem trata escrita offline é o outbox).
- **PWA básico**: `manifest` dinâmico ([app/manifest.ts](../app/manifest.ts)), `InstallPrompt` ([components/pwa/install-prompt.tsx](../components/pwa/install-prompt.tsx)) montado no dashboard, indicador Online/Offline no [FieldHeader](../components/mobile/field-header.tsx).
- **Lógica de ponto pura e offline-capable**: `resolverLedger`, `espelho`, `horas`, `ponto-dia` em [lib/ponto/](../lib/ponto/) — só transformam dados já em mãos; rodam 100% offline **se os dados estiverem locais**.
- **Fotos no payload**: capturadas e convertidas para **data URL base64**, embarcadas no JSON do lançamento → já entram no outbox (IndexedDB) e sincronizam depois. ✅ offline-capable (com ressalvas de tamanho, ver §2).

### 1.2. Mapa rota-a-rota (comportamento offline HOJE)

| Rota | Lê (GET) | Escreve | Offline hoje |
|---|---|---|---|
| `/` (login) | `POST /funcionarios/auth/login` | sessão | ⚠️ Abre se shell cacheado; **login em si exige rede** |
| `/dashboard` | `/equipamentos/comboios/:p/:f`, `/historico/:p` | outbox | ⚠️ **Reload offline → vazio** (sem cache persistente) |
| `/abastecer` | `/equipamentos/:p`, `/postos/:p`, `/equipamentos/comboios/:p/:f` | `submit("abastecimento")` | ✅ Salva offline; autocomplete vazio (digita manual) |
| `/reabastecer` | `/equipamentos/comboios/:p/:f` | `submit("reabastecimento")` | ✅ Salva offline |
| `/engraxar` | `/equipamentos/:p` | `submit("lubrificacao")` | ✅ Salva offline |
| `/ponto` | `/feature-flags/:p` | outbox `ponto` | ⚠️ Funciona se flag já cacheada; 1ª vez offline → redireciona |
| `/meu-ponto` | `/time-records/:p`, `/configuracoes/:p` | outbox `ponto` (novas) | ❌ **Lista some offline** |
| `/espelho` | `/time-records/:p`, `/escala/:p`, `/abonos/:p` | `editarHorario`/`solicitacoes` **direto** | ❌ **Espelho vazio; edições quebram** |
| `/historico` | `/historico/:p` | — | ⚠️ Reload offline → vazio |
| `/minhas-solicitacoes` | `/solicitacoes-ponto/:p` | `solicitacoes.criar` **direto** | ❌ **Lista some; criar quebra** |
| `/perfil` | `localStorage` | — | ✅ Funciona |

**Rotas que quebram totalmente offline:** `/meu-ponto`, `/espelho`, `/minhas-solicitacoes`,
e `/dashboard`/`/historico` em reload (estado só em memória React, perde no refresh).

---

## 2. Problemas encontrados (priorizados)

### 🔴 Críticos (impedem operação offline)

1. **Leituras sem cache persistente.** Toda consulta é `api.get` cross-origin → o SW não intercepta (correto) e não há cache local. Em qualquer reload offline ou cold start, dashboard/meu-ponto/espelho/histórico/solicitações ficam vazios ou em "Carregando…" infinito.
   - *Causa:* dados vivem só em estado React; nenhuma das funções de `lib/api/*` (exceto feature-flags) persiste.

2. **Service Worker não pré-cacheia os assets do Next.** `sw.js` só faz `cache.add("/")`. Os chunks `/_next/static/**` só entram em cache **depois** de uma visita online (via SWR). Um cold install seguido de offline → o app não monta. Pior: o fallback de navegação é `FALLBACK = "/"` (página de **login**), então uma rota profunda offline cai no login mesmo logado.

3. **Edições de ponto fora do outbox.** `pontoApi.editarHorario` ([lib/api/ponto.ts](../lib/api/ponto.ts)) e `solicitacoesPontoApi.criar` ([lib/api/solicitacoes-ponto.ts](../lib/api/solicitacoes-ponto.ts)) usam `api.post` direto → offline lançam erro e **perdem o dado** (não enfileiram).

4. **Login/sessão sem controle de expiração.** `expiresIn` do backend é **descartado** ([lib/api/auth.ts](../lib/api/auth.ts)); `getToken` devolve o token cru sem checar validade. A sessão só é limpa por 401/403 do servidor — o que **nunca chega offline**. Resultado: comportamento indefinido quando o JWT expira em campo (requests futuros falham silenciosamente quando a rede volta).

### 🟠 Altos (degradam a experiência / risco de perda)

5. **Sem backoff exponencial.** `flushOutbox` reescala num intervalo fixo de 30s; em 5xx/rede ele só **para** e espera o próximo tick. Sem `nextAttemptAt`, sem jitter, sem teto de tentativas → após dias offline, ao voltar a rede, dispara tudo de uma vez (thundering herd).

6. **Itens `failed` viram dead-letter sem saída.** Um 4xx marca `failed: true` e o item **nunca mais** é reenviado nem removido — fica preso no IndexedDB e some da contagem de "pendentes" mas aparece como "erro" para sempre, sem UI de reprocesso/descarte.

7. **Fotos em base64 dentro do JSON.** +33% de tamanho; várias fotos offline incham o IndexedDB e o payload do POST. Sem compressão/limite. (Backend de fotos do checklist já caminha para **Supabase Storage** — ver memória do projeto; alinhar.)

8. **Sem controle de versão/conflito nas leituras.** Pull substitui tudo; não há `updatedAt`/`rev` por registro nem `If-Modified-Since` → sempre baixa a lista inteira (caro em 3G) e não há base para sync incremental.

9. **Ponto-gate pode travar offline.** [ponto-gate.tsx](../components/mobile/ponto-gate.tsx) faz `await featureFlagsApi.pontoAtivo(...)` quando ainda não bateu hoje; offline cai no cache, mas se a flag nunca foi vista, libera por default (opt-in) — comportamento aceitável, mas o estado "Carregando…" depende de a Promise resolver.

### 🟡 Médios (PWA production-readiness)

10. **Ícones:** só 512 (`/icon`) + 180 (`/apple-icon`, marcado `maskable` — propósito trocado). **Falta 192** (mínimo Android), falta `maskable` num ícone com safe-area real, faltam splash screens iOS (`apple-touch-startup-image`).
11. **Ícones são rotas dinâmicas** (`ImageResponse` server-side). Offline precisam estar **pré-cacheados**, senão o manifest aponta para algo que não resolve.
12. **Update do SW agressivo:** `skipWaiting()` + `clients.claim()` imediatos, sem prompt "Atualização disponível" → pode trocar assets sob os pés do usuário no meio de um lançamento.
13. **Sem Background Sync / Periodic Sync / Push.** Toda sincronização depende do app estar **aberto** (intervalo 30s + evento `online`). App fechado = não sincroniza.
14. **Sem migração de dados nem versionamento de cache local.** IndexedDB v1 com 1 store; qualquer evolução de schema precisa de `onupgradeneeded` manual.

---

## 3. Arquitetura Offline-First recomendada

```
┌──────────────────────────────────────────────────────────────────────┐
│                            UI (React 19)                               │
│   telas lêem de hooks que entregam dados LOCAIS primeiro (instantâneo) │
└───────────────┬───────────────────────────────────┬──────────────────┘
                │ read-through (SWR)                 │ write (event)
                ▼                                     ▼
┌───────────────────────────────┐     ┌──────────────────────────────────┐
│  Repositórios (lib/data/*)    │     │   Outbox de eventos (lib/sync)    │
│  - lê Dexie (cache) → retorna │     │   - enfileira CREATE_* / UPDATE_* │
│  - revalida rede em background│     │   - idempotência + backoff + DLQ  │
│  - grava Dexie + notifica     │     │   - Background Sync API            │
└──────────┬────────────────────┘     └───────────────┬──────────────────┘
           │                                           │
           ▼                                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  IndexedDB via Dexie (hu360-comboio v2)                │
│  tabelas de leitura (equipamentos, comboios, postos, timeRecords,     │
│  historico, escala, abonos, solicitacoes, featureFlags, empresa) +    │
│  outbox + session + meta (cursores de sync)                           │
└──────────────────────────────────────────────────────────────────────┘
           ▲                                           ▲
           │ pull (GET, SWR / incremental)             │ push (POST/PATCH idempotente)
           ▼                                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Backend NestJS (back-360-)                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Service Worker (Serwist): precache app-shell + _next/static,         │
│  runtime caching de ícones/imagens, Background Sync para o outbox      │
└──────────────────────────────────────────────────────────────────────┘
```

**Princípios:**

1. **Local-first read:** a UI nunca espera a rede para mostrar dados que já viu. Repositório retorna o cache Dexie de imediato e dispara revalidação em background (stale-while-revalidate).
2. **Write-as-event:** toda mutação é um **evento idempotente** no outbox. A tela reage ao estado local (otimista), nunca ao sucesso da rede.
3. **A rede é um detalhe:** `navigator.onLine` é dica, não verdade. O sistema tenta sempre; falha de rede só muda *quando*, nunca *se* o dado é salvo.
4. **Server-authoritative no pull, client-authoritative no push:** conflitos de leitura resolvem com "servidor vence" (LWW por `updatedAt`); escritas são append-only/ledger (baixo conflito) e protegidas por idempotência.

---

## 4. Fluxo completo de sincronização

### 4.1. Pull (leitura: rede → local)

```
app foca / volta online / tick de 60s / abre uma tela
        │
        ▼
para cada entidade "stale" (cachedAt > TTL):
        │
        ├─ GET /<recurso>/:prefeitura            (com If-Modified-Since / ?since= se suportado)
        │       ├─ 304 Not Modified → mantém cache, atualiza cachedAt
        │       ├─ 200 lista        → upsert em Dexie (LWW por updatedAt), marca cachedAt
        │       └─ erro/offline     → mantém cache anterior (nunca apaga)
        │
        ▼
notifica listeners → hooks re-renderizam com dado fresco
```

- **TTL por entidade** (sugerido): equipamentos/postos 24h; comboios/tanques 5min (volume muda); time-records/historico 2min; escala/empresa 24h; feature-flags 1h.
- **Sync incremental:** quando o backend expuser `?updatedSince=<iso>` (ver §10, dependências), o pull manda o cursor de `meta.lastSyncedAt[entidade]` e faz **upsert** só do delta. Até lá, full-replace por entidade (idempotente).

### 4.2. Push (escrita: local → rede)

```
usuário confirma um lançamento
        │
        ▼
grava evento no outbox (status=pending, attempts=0)  +  aplica otimista no cache local
        │
        ▼
agendador de flush (online | tick | Background Sync 'sync' event):
        │
   para cada evento pending com nextAttemptAt <= agora (ordenado por createdAt):
        │
        ├─ POST/PATCH <path> com Idempotency-Key estável
        │       ├─ 2xx        → remove do outbox, marca registro local como "synced"
        │       ├─ 409 (proc) → mantém pending, agenda retry (transitório)
        │       ├─ 4xx        → status=failed (dead-letter), expõe na UI p/ ação manual
        │       └─ 5xx/rede   → attempts++, nextAttemptAt = backoff(attempts), para o lote
        ▼
notifica UI (contadores pendentes/erros)
```

### 4.3. Retry + backoff exponencial

```
backoff(n) = min(BASE * 2^n, MAX) ± jitter
  BASE = 5s, MAX = 5min, jitter = ±20%
  n=0 → ~5s   n=1 → ~10s   n=2 → ~20s … teto 5min
MAX_ATTEMPTS = 8  → depois marca failed (dead-letter)
```

### 4.4. Resolução de conflitos

| Tipo de dado | Estratégia | Por quê |
|---|---|---|
| Ponto (batidas) | **Append-only ledger** (Portaria 671) + idempotência | Imutável por lei; nunca há "update destrutivo", só ajuste/cancelamento como novos registros. |
| Abastecimento / engraxe / reabastecimento | **Idempotência** (mesma `Idempotency-Key` no envio e nos reenvios) | Evita duplicata; lançamentos são eventos independentes (sem conflito entre si). |
| Edições (`editarHorario`, `solicitacoes`) | Outbox + `baseId`/`baseUpdatedAt`; backend rejeita stale → `failed` com motivo | São mutações sobre um registro existente; precisam de versão base. |
| Caches de leitura | **LWW (server wins)** por `updatedAt` | Cliente é só espelho; servidor é a verdade. |

---

## 5. Estrutura do banco local (Dexie)

> **Por que Dexie:** wrapper tipado sobre IndexedDB, migrações declarativas por versão,
> índices compostos, `liveQuery` (reativo), transações simples. ~25 kB gz. O outbox atual
> já é IndexedDB puro — migrar para Dexie remove ~80 linhas de boilerplate e dá índices.

`lib/db.ts`:

```ts
import Dexie, { type Table } from "dexie";

// --- Tipos de cache (read models) — espelham as respostas do NestJS ---
export interface Cached<T> { key: string; data: T; updatedAt: string; cachedAt: number }

export interface OutboxEvent {
  id: string;                       // uuid
  type:                             // ver §6
    | "CREATE_ABASTECIMENTO" | "CREATE_LUBRIFICACAO" | "CREATE_REABASTECIMENTO"
    | "CREATE_PUNCH" | "UPDATE_PUNCH" | "CREATE_SOLICITACAO";
  path: string;                     // endpoint NestJS
  method: "POST" | "PATCH";
  payload: unknown;
  idempotencyKey: string;
  baseId?: string;                  // p/ updates: registro alvo
  baseUpdatedAt?: string;           // p/ detecção de conflito
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;            // backoff
  status: "pending" | "failed";
  lastError?: string;
}

export interface SessionRecord {
  id: "current";
  token: string;
  expiresAt: number;                // epoch ms — derivado de expiresIn
  trustedUntil: number;             // janela de uso offline (ver §7)
  user: SessionUser;                // de lib/session.ts
  offlineCredential?: string;       // PBKDF2(senha) p/ re-login local (opcional)
}

export interface Meta { key: string; value: unknown } // cursores: lastSyncedAt:<entidade>

export class HU360Db extends Dexie {
  // caches de leitura (1 linha por chave: prefeituraId, ou prefeitura:funcionario)
  equipamentos!: Table<Cached<unknown>, string>;
  comboios!: Table<Cached<unknown>, string>;
  postos!: Table<Cached<unknown>, string>;
  timeRecords!: Table<Cached<unknown>, string>;
  historico!: Table<Cached<unknown>, string>;
  escala!: Table<Cached<unknown>, string>;
  abonos!: Table<Cached<unknown>, string>;
  solicitacoes!: Table<Cached<unknown>, string>;
  featureFlags!: Table<Cached<unknown>, string>;
  empresa!: Table<Cached<unknown>, string>;
  // infra
  outbox!: Table<OutboxEvent, string>;
  session!: Table<SessionRecord, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super("hu360-comboio");
    // v1 = store "outbox" legado (IndexedDB puro). v2 adiciona as tabelas novas
    // e MIGRA os itens antigos do outbox para o novo formato de evento.
    this.version(2).stores({
      equipamentos: "key", comboios: "key", postos: "key",
      timeRecords: "key", historico: "key", escala: "key", abonos: "key",
      solicitacoes: "key", featureFlags: "key", empresa: "key",
      outbox: "id, status, nextAttemptAt, createdAt",
      session: "id",
      meta: "key",
    }).upgrade(async (tx) => {
      // migra itens do outbox legado {id,kind,payload,...} → OutboxEvent
      const legacy = await tx.table("outbox").toArray();
      // (mapear kind→type/path/method; manter idempotencyKey/createdAt) — ver §8 fase 2
    });
  }
}

export const db = new HU360Db();
```

**Entidades que precisam ser persistidas localmente:** usuário/sessão (✓), equipamentos,
comboios+tanques, postos, time-records (ponto), histórico de lançamentos, escala, abonos,
solicitações de ponto, feature-flags, dados da empresa (CRPT) — **todas as origens de GET**
de [lib/api/](../lib/api/) viram tabela de cache. Mais: **outbox** (fila) e **meta** (cursores).

> Checklists/formulários genéricos **não existem** neste app hoje (o comboista lança
> abastecimento/engraxe/ponto, não preenche checklist de campo — esse é o outro PWA, o do
> checklist em `src/`). Se entrarem aqui no futuro, seguem o mesmo padrão: tabela de cache +
> evento `CREATE_CHECKLIST`/`UPDATE_CHECKLIST` no outbox.

---

## 6. Estrutura da fila de eventos

Toda escrita vira um **evento tipado** no outbox (tabela Dexie `outbox`). Mapeamento:

| Evento | path | method | origem hoje |
|---|---|---|---|
| `CREATE_ABASTECIMENTO` | `/abastecimentos` | POST | `submit("abastecimento")` |
| `CREATE_LUBRIFICACAO` | `/lubrificacoes` | POST | `submit("lubrificacao")` |
| `CREATE_REABASTECIMENTO` | `/reabastecimentos` | POST | `submit("reabastecimento")` |
| `CREATE_PUNCH` | `/time-records` | POST | `enqueue("ponto")` |
| `UPDATE_PUNCH` | `/time-records/update/:id` | POST | `editarHorario` ⟵ **migrar p/ outbox** |
| `CREATE_SOLICITACAO` | `/solicitacoes-ponto` | POST | `solicitacoes.criar` ⟵ **migrar p/ outbox** |
| `UPLOAD_IMAGE` (futuro) | `/uploads` (Supabase signed) | POST | hoje base64 no payload ⟶ §10 |

**Propriedades de cada evento:** `id`, `type`, `path`, `method`, `payload`,
`idempotencyKey` (estável), `baseId`/`baseUpdatedAt` (updates), `createdAt`, `attempts`,
`nextAttemptAt`, `status`, `lastError`. Ordem de envio: FIFO por `createdAt`.

**Disparo:** (1) ao confirmar a ação (tenta na hora se online), (2) evento `online`,
(3) tick de 30s enquanto o app está aberto, (4) **Background Sync** `sync` event (app fechado),
(5) **Periodic Sync** (best-effort, Chromium) para flush oportunista.

---

## 7. Estratégia do Service Worker (por recurso)

> **Recomendação: adotar [Serwist](https://serwist.pages.dev/)** (sucessor mantido do
> `next-pwa`, suporte oficial a App Router / Next 15+). Ele gera o **precache manifest**
> dos assets do build (`_next/static/**`) com revisão por hash — o que resolve o problema #2
> (boot offline). Validar compatibilidade com Next **16.2.7 + Turbopack** antes (ver
> `node_modules/next/dist/docs/`, conforme [AGENTS.md](../AGENTS.md)). Fallback: manter o
> `sw.js` à mão e injetar o manifest de precache no build.

| Recurso | Estratégia | Racional |
|---|---|---|
| **Navegação (HTML/RSC)** | **NetworkFirst** + fallback p/ app-shell **da rota** (não `/`) | Fresco quando online; abre offline sem cair no login. |
| **`_next/static/**`** (JS/CSS hash) | **CacheFirst** (precache, imutável) | Conteúdo versionado por hash; nunca muda sob o mesmo nome. |
| **`_next/data` / RSC payloads** | **StaleWhileRevalidate** | Render instantâneo do último conhecido + atualiza em background. |
| **Ícones `/icon`, `/apple-icon`, `manifest`** | **Precache** no install + SWR | Rotas dinâmicas; precisam existir offline p/ install/splash. |
| **Imagens** (fotos, ícones de equipamento; cross-origin Supabase) | **CacheFirst** + expiração LRU (maxEntries ~60, maxAge 30d) | Imagens são pesadas e imutáveis; LRU evita estourar quota. |
| **API NestJS (GET cross-origin)** | **NÃO interceptar** — cache fica no **Dexie** (camada de dados) | Mais controle, queryable, TTL por entidade, conflito tratável. SW cacheando JSON cross-origin seria opaco e cego ao domínio. |
| **API NestJS (POST/PATCH)** | **NÃO interceptar** + **Background Sync** (registrar `sync` tag) | Escrita é responsabilidade do outbox; Background Sync só acorda o flush. |

**Versionamento de cache:** nome do cache inclui o `buildId`; `activate` limpa versões
antigas (Serwist faz isso pelo precache manifest). **Atualização:** trocar `skipWaiting`
imediato por **prompt "Atualização disponível"** — o novo SW espera (`waiting`) e só assume
quando o usuário confirma (evita troca de chunk no meio de um lançamento).

---

## 8. Plano de implementação em fases

> Cada fase é entregável e testável isoladamente. Ordem por **risco × valor**: primeiro o
> que destrava operação offline real, depois robustez e PWA polish.

### Fase 0 — Fundação (Dexie + boot offline) — _desbloqueia tudo_
- Adicionar `dexie` (e, se for Serwist, `@serwist/next` + `serwist`).
- Criar [lib/db.ts](../lib/db.ts) (schema v2 + migração do outbox legado).
- **Service Worker:** precache do app-shell + `_next/static` (Serwist) **ou** injeção de
  manifest no `sw.js`. Corrigir fallback de navegação (rota, não `/`). Prompt de update.
- ✅ *Critério:* instalar online, fechar, abrir offline → o app **monta** e navega entre rotas já visitadas.

### Fase 1 — Outbox robusto (escrita) — _proteger o dado_
- Migrar `outbox.ts` para Dexie; eventos tipados (§6).
- **Backoff exponencial** + `nextAttemptAt` + `MAX_ATTEMPTS` + jitter.
- **Dead-letter UI:** tela/area de "erros de sincronização" com **reprocessar** / **descartar**.
- Migrar `editarHorario` e `solicitacoes.criar` para o outbox (`UPDATE_PUNCH`, `CREATE_SOLICITACAO`).
- **Background Sync API:** registrar `sync` tag no submit; SW dispara `flushOutbox` no evento.
- ✅ *Critério:* lançar offline por "dias", fechar o app, voltar a rede → tudo sincroniza sem duplicar e sem perder; 4xx vai para dead-letter com ação manual.

### Fase 2 — Leituras offline (cache read-through) — _consultar offline_
- Repositórios `lib/data/*` que envolvem cada `lib/api/*`: lê Dexie → retorna → revalida.
- Hooks reativos (`useCachedQuery` sobre `liveQuery`) para dashboard, meu-ponto, espelho,
  histórico, solicitações, comboios/equipamentos/postos.
- Pull scheduler (online | foco | tick) com TTL por entidade.
- ✅ *Critério:* todas as rotas da §1.2 mostram **o último dado conhecido** offline e em reload; nada de "Carregando…" infinito.

### Fase 3 — Login & sessão offline — _entrar offline_
- Persistir `{ token, expiresAt, trustedUntil, user, offlineCredential }` (Dexie `session` + mirror em `localStorage` para leitura síncrona no boot).
- Guard de sessão: abre offline enquanto `trustedUntil` válido (janela 7d, alinhado ao app principal — ver `[[login-offline-operador]]`). Token perto de expirar + online → **renova** silenciosamente.
- **Re-login offline opcional:** `PBKDF2(senha, salt)` salvo no 1º login; permite re-autenticar localmente e **estender** a janela confiável sem rede.
- ✅ *Critério:* usuário que logou uma vez abre o app offline por dias; expiração é controlada e previsível.

### Fase 4 — PWA production-ready — _instalar & atualizar bem_
- Ícones: gerar **192 + 512 (any)** e um **maskable** com safe-area; corrigir `purpose`.
- Splash screens iOS (`apple-touch-startup-image`), `manifest.id`/`scope`/`categories`/screenshots.
- Garantir precache dos ícones dinâmicos.
- (Opcional) **Push Notifications** (ex.: "ajuste de ponto aprovado") via `back-360-` + VAPID; **Periodic Sync** para flush oportunista.
- ✅ *Critério:* Lighthouse PWA "installable" sem warnings; update via prompt; ícone correto na home.

### Fase 5 — Sync incremental & versionamento — _escala/3G_
- **Dependência de backend:** `?updatedSince=`/`If-Modified-Since` + `updatedAt`/`rev` por registro.
- Cursores em `meta`; upsert de delta; `baseUpdatedAt` nos updates p/ detecção de conflito.
- ✅ *Critério:* pull transfere só o delta; updates conflitantes caem em dead-letter com motivo claro.

---

## 9. Código necessário por etapa (esqueletos)

> Esqueletos copiáveis; os trechos marcados `// TODO` dependem de decisão/backend.

### 9.1. Repositório read-through genérico (Fase 2)

`lib/data/repo.ts`:

```ts
import { db, type Cached } from "@/lib/db";
import type { Table } from "dexie";

const TTL_DEFAULT = 2 * 60_000;

/** Lê o cache na hora; revalida em background; grava e notifica. */
export async function readThrough<T>(
  table: Table<Cached<T>, string>,
  key: string,
  fetcher: () => Promise<T>,
  ttl = TTL_DEFAULT,
): Promise<T | undefined> {
  const cached = await table.get(key);
  const stale = !cached || Date.now() - cached.cachedAt > ttl;
  if (stale && (typeof navigator === "undefined" || navigator.onLine)) {
    // revalida sem bloquear o retorno do cache
    void fetcher()
      .then((data) =>
        table.put({ key, data, updatedAt: new Date().toISOString(), cachedAt: Date.now() }),
      )
      .catch(() => {/* offline/erro: mantém cache */});
  }
  return cached?.data;
}
```

`lib/data/use-cached.ts` (hook reativo via Dexie `liveQuery`):

```ts
"use client";
import { useEffect, useState } from "react";
import { liveQuery } from "dexie";

export function useCached<T>(
  read: () => Promise<T | undefined>,
  revalidate: () => Promise<unknown>,
  deps: unknown[],
) {
  const [data, setData] = useState<T>();
  useEffect(() => {
    const sub = liveQuery(read).subscribe({ next: (d) => setData(d as T) });
    void revalidate();           // dispara SWR ao montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => sub.unsubscribe();
  }, deps);
  return data;
}
```

Exemplo de repositório de comboios (envolve [lib/api/comboios.ts](../lib/api/comboios.ts)):

```ts
// lib/data/comboios.ts
import { db } from "@/lib/db";
import { readThrough } from "./repo";
import { listarComboiosDoMotorista } from "@/lib/api/comboios";

export const comboiosRepo = {
  key: (p: string, f: string) => `${p}:${f}`,
  async get(p: string, f: string) {
    return readThrough(db.comboios, this.key(p, f),
      () => listarComboiosDoMotorista(p, f), 5 * 60_000);
  },
};
```

### 9.2. Outbox com backoff + Background Sync (Fase 1)

`lib/sync/outbox.ts` (núcleo — substitui [lib/offline/outbox.ts](../lib/offline/outbox.ts)):

```ts
import { db, type OutboxEvent } from "@/lib/db";
import { api, ApiError } from "@/lib/api/client";

const BASE = 5_000, MAX = 5 * 60_000, MAX_ATTEMPTS = 8;
const backoff = (n: number) =>
  Math.min(BASE * 2 ** n, MAX) * (0.8 + Math.random() * 0.4); // jitter ±20%

export async function enqueue(ev: Omit<OutboxEvent,
  "id" | "createdAt" | "attempts" | "nextAttemptAt" | "status">) {
  await db.outbox.add({
    ...ev, id: crypto.randomUUID(), createdAt: Date.now(),
    attempts: 0, nextAttemptAt: 0, status: "pending",
  });
  await requestBackgroundSync();   // acorda o SW
}

let running = false;
export async function flushOutbox() {
  if (running) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  running = true;
  try {
    const now = Date.now();
    const pend = (await db.outbox.where("status").equals("pending").sortBy("createdAt"))
      .filter((e) => e.nextAttemptAt <= now);
    for (const ev of pend) {
      try {
        await api[ev.method === "PATCH" ? "patch" : "post"](
          ev.path, ev.payload, { idempotencyKey: ev.idempotencyKey });
        await db.outbox.delete(ev.id);
      } catch (e) {
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 409) {
          await db.outbox.update(ev.id, { status: "failed", lastError: e.message });
          continue;                              // dead-letter → UI manual
        }
        const attempts = ev.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await db.outbox.update(ev.id, { status: "failed", lastError: "max attempts" });
        } else {
          await db.outbox.update(ev.id,
            { attempts, nextAttemptAt: Date.now() + backoff(attempts) });
        }
        break;                                   // 5xx/rede: para o lote
      }
    }
  } finally { running = false; }
}

async function requestBackgroundSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    // @ts-expect-error sync nem sempre tipado
    await reg?.sync?.register("flush-outbox");
  } catch {/* sem suporte: cai no tick/online */}
}
```

No SW (Serwist `app/sw.ts` ou `public/sw.js`):

```js
self.addEventListener("sync", (event) => {
  if (event.tag === "flush-outbox") {
    event.waitUntil(
      self.clients.matchAll().then((cs) =>
        cs.forEach((c) => c.postMessage({ type: "FLUSH_OUTBOX" }))),
    ); // a página executa flushOutbox() (acesso ao token/Dexie). Alternativa: flush no próprio SW.
  }
});
```

### 9.3. Sessão offline (Fase 3)

`lib/auth/session.ts` (estende [lib/session.ts](../lib/session.ts)):

```ts
const TRUST_WINDOW = 7 * 24 * 60 * 60_000; // 7 dias offline (alinhar app principal)

export async function saveSession(token: string, user: SessionUser, expiresIn: string) {
  const expiresAt = Date.now() + parseExpires(expiresIn);     // "15m" / "7d" → ms
  await db.session.put({
    id: "current", token, expiresAt,
    trustedUntil: Date.now() + TRUST_WINDOW, user,
  });
  localStorage.setItem("hu360_token", token);                 // leitura síncrona no boot
  localStorage.setItem("hu360_user", JSON.stringify(user));
}

/** Pode usar o app agora? (offline-first) */
export async function sessionUsable(): Promise<boolean> {
  const s = await db.session.get("current");
  if (!s) return false;
  if (navigator.onLine && Date.now() > s.expiresAt) return await tryRefresh(s);
  return Date.now() < s.trustedUntil; // offline: vale enquanto na janela confiável
}
// tryRefresh → POST /funcionarios/auth/refresh (TODO: endpoint no back-360-)
```

### 9.4. Service Worker (Fase 0) — Serwist

```ts
// app/sw.ts  (Serwist injeta self.__SW_MANIFEST com os assets do build)
import { Serwist, NetworkFirst, CacheFirst, StaleWhileRevalidate } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,           // _next/static + app-shell
  skipWaiting: false,                            // espera prompt de update
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    { matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({ cacheName: "pages", networkTimeoutSeconds: 3 }) },
    { matcher: ({ url }) => url.pathname.startsWith("/_next/static"),
      handler: new CacheFirst({ cacheName: "static" }) },
    { matcher: ({ url }) => /\/(icon|apple-icon|manifest)/.test(url.pathname),
      handler: new StaleWhileRevalidate({ cacheName: "app-icons" }) },
    { matcher: ({ request }) => request.destination === "image",
      handler: new CacheFirst({ cacheName: "images" /* + ExpirationPlugin */ }) },
  ],
});
serwist.addEventListeners();
```

> Se Serwist não casar com Next 16.2.7/Turbopack: manter [public/sw.js](../public/sw.js)
> e gerar um `precache-manifest.js` no `postbuild` (lista de `/_next/static/**` + rotas-shell)
> para o `install` fazer `cache.addAll(...)`.

---

## 10. Checklist final para produção

### Funcional / offline
- [ ] Cold install → fechar → **abrir offline**: app monta e navega (Fase 0).
- [ ] Reload offline em `/dashboard`, `/meu-ponto`, `/espelho`, `/historico`, `/minhas-solicitacoes`: mostram último dado conhecido (Fase 2).
- [ ] Lançar abastecimento/engraxe/reabastecimento/ponto **offline** → aparece como pendente → sincroniza ao voltar a rede **sem duplicar** (idempotência).
- [ ] Editar horário de ponto e criar solicitação **offline** → enfileiram (não quebram) (Fase 1).
- [ ] App fechado: Background Sync envia a fila ao recuperar rede (Fase 1).
- [ ] 4xx no envio → item em "erros", com **reprocessar/descartar** (dead-letter).
- [ ] Backoff exponencial verificado (não dispara tudo de uma vez após dias offline).
- [ ] Login uma vez online → usar app offline por dias; expiração previsível; renovação ao voltar (Fase 3).

### PWA
- [ ] Ícones 192 + 512 (any) + maskable com safe-area; `purpose` correto.
- [ ] Manifest com `id`, `scope`, `start_url`, `display: standalone`, `theme/background`.
- [ ] Splash iOS (`apple-touch-startup-image`) e `apple-mobile-web-app-*`.
- [ ] Install prompt funcional (Android nativo + instruções iOS).
- [ ] Prompt "Atualização disponível" (sem `skipWaiting` cego).
- [ ] Lighthouse PWA: **installable**, sem erros; offline_start_url passa.
- [ ] (Opcional) Push (VAPID) e Periodic Sync.

### Robustez / dados
- [ ] Migração Dexie v1→v2 sem perder itens do outbox legado.
- [ ] Quota IndexedDB monitorada (fotos base64); estratégia de compressão/limpeza pós-sync.
- [ ] Nenhum cache de leitura é apagado em falha de rede (só atualizado em sucesso).
- [ ] `navigator.onLine` tratado como dica (toda escrita tenta e degrada para fila).

### Dependências de backend (`back-360-`, repo separado)
- [ ] `UPDATE_PUNCH` (`/time-records/update/:id`) e `CREATE_SOLICITACAO` aceitam `Idempotency-Key`.
- [ ] (Fase 5) GET de listas aceitam `?updatedSince=`/`If-Modified-Since` e retornam `updatedAt`/`rev` por registro.
- [ ] (Fase 3) Endpoint de **refresh** de token (`/funcionarios/auth/refresh`).
- [ ] (Fotos) Migrar de base64-no-JSON para **upload Supabase** com URL assinada (alinhar com `back#35` / Storage do checklist) → evento `UPLOAD_IMAGE`.

---

## Apêndice — Decisões em aberto (precisam do dono do projeto)

1. **Login offline — modelo de segurança:** só janela confiável de 7d (mais simples) **ou** também credencial offline `PBKDF2` para re-login local sem rede (mais resiliente, mais superfície)? Recomendo alinhar ao app principal (`[[login-offline-operador]]`: sessão + credencial 7d).
2. **Serwist vs SW à mão:** adotar Serwist (melhor DX, precache automático) assumindo o risco de compat com Next 16/Turbopack, ou evoluir o `sw.js` manual (menor risco, mais trabalho)?
3. **Fotos:** manter base64 no outbox por ora (simples, já funciona) ou já migrar para upload Supabase (escala melhor, depende de backend)?
4. **Push Notifications:** entram agora (Fase 4) ou ficam para depois? Exigem VAPID + endpoint no back.
```
