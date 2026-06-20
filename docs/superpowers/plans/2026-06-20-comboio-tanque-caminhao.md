# Comboio: tanque do caminhão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cadastrar a capacidade do tanque do próprio caminhão de um comboio (admin) e abastecer esse tanque pelo PWA, validando os litros pela capacidade certa.

**Architecture:** Um único campo novo no equipamento — `capacidadeTanqueCaminhao`. A regra de capacidade ao abastecer passa a depender do `tipo` do equipamento ALVO: comboio → tanque do caminhão; demais → tanque do equipamento. O payload de abastecimento **não muda**; a origem (débito do reservatório/posto) permanece igual. Spec: [docs/superpowers/specs/2026-06-20-comboio-tanque-caminhao-design.md](../specs/2026-06-20-comboio-tanque-caminhao-design.md).

**Tech Stack:** NestJS + Firestore (`back`), React + Vite (`360-repository`), Next.js 16 PWA + Dexie (`pwa-comboio`). Todos pnpm. Jest no back; Vitest nos outros.

## Global Constraints

- Nome do campo, EXATO em todos os repos: `capacidadeTanqueCaminhao` (number, opcional).
- `capacidadeTanque` permanece como está; para comboio continua sendo o **reservatório** (sincroniza com `tanks.capacity`). Sem migração de dados.
- "É comboio?" é case-insensitive: `tipo.trim().toLowerCase() === "comboio"`.
- Capacidade `0`/ausente/inválida = **sem limite** (não bloqueia no front; back é o gate final).
- **Reabastecimento NÃO muda** (continua só no reservatório).
- Branch em cada repo: `feat/comboio-tanque-caminhao`, a partir de `origin/homolog`, PR para `homolog`.
- Commits: conventional commits, em PT, **sem assinatura de IA** (convenção da equipe).
- Ordem de entrega/merge: **back → 360 → pwa** (o campo precisa existir/persistir antes dos consumidores).

---

## Phase A — back (NestJS)

Diretório: `/Users/viniciusaguiar/Development/horautil/back`

### Task A1: Campo `capacidadeTanqueCaminhao` no DTO de equipamento

**Files:**
- Modify: `src/modules/equipamentos/dto/create-equipamento.dto.ts` (após o campo `capacidadeTanque`, ~linha 166)
- (UpdateEquipamentoDto herda via `PartialType(CreateEquipamentoDto)` — sem edição)

**Interfaces:**
- Produces: campo `capacidadeTanqueCaminhao?: number` aceito em `POST /equipamentos` e `POST /equipamentos/update/:id`.

- [ ] **Step 1: Criar a branch a partir de homolog**

```bash
cd /Users/viniciusaguiar/Development/horautil/back
git fetch origin
git checkout -b feat/comboio-tanque-caminhao origin/homolog
```

- [ ] **Step 2: Adicionar o campo ao CreateEquipamentoDto**

Em `src/modules/equipamentos/dto/create-equipamento.dto.ts`, logo após o bloco do `capacidadeTanque` (que termina na linha `capacidadeTanque?: number;`), inserir:

```ts
  @ApiProperty({
    description:
      'Capacidade do tanque do próprio caminhão do comboio (litros). Só se ' +
      'aplica a tipo Comboio; usada como teto ao abastecer o caminhão.',
    required: false,
    example: 400,
  })
  capacidadeTanqueCaminhao?: number;
```

- [ ] **Step 3: Compilar para garantir que o DTO está válido**

Run: `pnpm build`
Expected: build conclui sem erros de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/modules/equipamentos/dto/create-equipamento.dto.ts
git commit -m "feat(equipamentos): campo capacidadeTanqueCaminhao no DTO"
```

### Task A2: Helpers puros `ehComboio` + `capacidadeAlvoAbastecimento` (TDD)

**Files:**
- Modify: `src/modules/movimentacoes/abastecimentos/helpers/abastecimentos-create.helper.ts`
- Test: `src/modules/movimentacoes/abastecimentos/helpers/abastecimentos-create.helper.spec.ts`

**Interfaces:**
- Produces:
  - `ehComboio(tipo: unknown): boolean`
  - `capacidadeAlvoAbastecimento(rawEquipment: Record<string, unknown>): number` — retorna o teto de litros (comboio → `capacidadeTanqueCaminhao`; demais → `capacidadeTanque`; 0 = sem limite).

- [ ] **Step 1: Escrever o teste que falha**

No fim do `describe('abastecimentos-create.helper', ...)` em `abastecimentos-create.helper.spec.ts`, e adicionando os imports no topo (`ehComboio`, `capacidadeAlvoAbastecimento`):

```ts
  describe('ehComboio', () => {
    it('reconhece comboio ignorando caixa e espaços', () => {
      expect(ehComboio('Comboio')).toBe(true);
      expect(ehComboio('  comboio ')).toBe(true);
      expect(ehComboio('Caminhões')).toBe(false);
      expect(ehComboio(undefined)).toBe(false);
    });
  });

  describe('capacidadeAlvoAbastecimento', () => {
    it('comboio usa capacidadeTanqueCaminhao (não o reservatório)', () => {
      expect(
        capacidadeAlvoAbastecimento({
          tipo: 'Comboio',
          capacidadeTanque: 5000,
          capacidadeTanqueCaminhao: 400,
        }),
      ).toBe(400);
    });

    it('equipamento comum usa capacidadeTanque', () => {
      expect(
        capacidadeAlvoAbastecimento({ tipo: 'Caminhões', capacidadeTanque: 300 }),
      ).toBe(300);
    });

    it('0 / ausente / inválida = sem limite (0)', () => {
      expect(
        capacidadeAlvoAbastecimento({ tipo: 'Comboio', capacidadeTanqueCaminhao: 0 }),
      ).toBe(0);
      expect(capacidadeAlvoAbastecimento({ tipo: 'Comboio' })).toBe(0);
      expect(
        capacidadeAlvoAbastecimento({ tipo: 'Caminhões', capacidadeTanque: 'x' }),
      ).toBe(0);
    });
  });
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `pnpm test -- abastecimentos-create.helper`
Expected: FAIL — `ehComboio`/`capacidadeAlvoAbastecimento` não existem (erro de import/compilação).

- [ ] **Step 3: Implementar os helpers**

No fim de `abastecimentos-create.helper.ts`, adicionar:

```ts
/** Comboio? (case-insensitive, igual ao módulo equipamentos). */
export function ehComboio(tipo: unknown): boolean {
  return typeof tipo === 'string' && tipo.trim().toLowerCase() === 'comboio';
}

/**
 * Capacidade-alvo (teto de litros) ao abastecer um equipamento:
 * - comboio → `capacidadeTanqueCaminhao` (tanque do próprio caminhão);
 * - demais  → `capacidadeTanque` (tanque do equipamento).
 * 0/ausente/inválida = 0 (sem limite). Pura — testável.
 */
export function capacidadeAlvoAbastecimento(
  rawEquipment: Record<string, unknown>,
): number {
  const campo = ehComboio(rawEquipment.tipo)
    ? rawEquipment.capacidadeTanqueCaminhao
    : rawEquipment.capacidadeTanque;
  const n = Number(campo);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `pnpm test -- abastecimentos-create.helper`
Expected: PASS (todos os casos novos verdes).

- [ ] **Step 5: Commit**

```bash
git add src/modules/movimentacoes/abastecimentos/helpers/abastecimentos-create.helper.ts \
        src/modules/movimentacoes/abastecimentos/helpers/abastecimentos-create.helper.spec.ts
git commit -m "feat(abastecimentos): helper de capacidade-alvo por tipo (comboio)"
```

### Task A3: Aplicar a capacidade-alvo na validação do abastecimento

**Files:**
- Modify: `src/modules/movimentacoes/abastecimentos/abastecimentos.service.ts` (import ~linha 13-19; validação ~linha 103-114)

**Interfaces:**
- Consumes: `capacidadeAlvoAbastecimento`, `ehComboio` (Task A2); `ResolvedEquipment.raw` (já existe).

- [ ] **Step 1: Adicionar os imports do helper**

Em `abastecimentos.service.ts`, no import de `'./helpers/abastecimentos-create.helper'` (linhas 13-19), incluir os dois nomes:

```ts
import {
  capacidadeAlvoAbastecimento,
  deveAtualizarMedicaoAtual,
  ehComboio,
  isSupportedMeasurementType,
  maiorLeituraRegistrada,
  parseLiters,
  resolveAbastecimentoPricing,
} from './helpers/abastecimentos-create.helper';
```

- [ ] **Step 2: Trocar a checagem de capacidade**

Substituir o bloco atual (linhas ~103-114):

```ts
    // Não abastecer mais do que o tanque do equipamento comporta (vale com ou
    // sem posto — o destino é sempre o tanque do equipamento). Capacidade
    // ausente/0 = sem limite (equipamento sem capacidadeTanque cadastrada).
    if (
      equipamento.capacidadeTanque > 0 &&
      liters > equipamento.capacidadeTanque
    ) {
      throw new BadRequestException(
        `Acima da capacidade do tanque do equipamento: ${liters} L solicitado(s), ` +
          `capacidade ${equipamento.capacidadeTanque} L.`,
      );
    }
```

por:

```ts
    // Não abastecer mais do que o tanque ALVO comporta. Para comboio o alvo é o
    // tanque do próprio caminhão (capacidadeTanqueCaminhao); para os demais, o
    // tanque do equipamento (capacidadeTanque). A origem (reservatório/posto) é
    // tratada à parte. Capacidade ausente/0 = sem limite.
    const capacidadeAlvo = capacidadeAlvoAbastecimento(equipamento.raw);
    if (capacidadeAlvo > 0 && liters > capacidadeAlvo) {
      const ondeCabe = ehComboio(equipamento.raw.tipo)
        ? 'tanque do caminhão do comboio'
        : 'tanque do equipamento';
      throw new BadRequestException(
        `Acima da capacidade do ${ondeCabe}: ${liters} L solicitado(s), ` +
          `capacidade ${capacidadeAlvo} L.`,
      );
    }
```

- [ ] **Step 3: Build + suíte completa**

Run: `pnpm build && pnpm test`
Expected: build sem erros; **todos** os testes passam (inclusive os novos da Task A2).

- [ ] **Step 4: Commit**

```bash
git add src/modules/movimentacoes/abastecimentos/abastecimentos.service.ts
git commit -m "feat(abastecimentos): validar litros pela capacidade do tanque-alvo (comboio = caminhão)"
```

### Task A4: Push + PR (back)

- [ ] **Step 1: Lint de CI (não deve introduzir erros novos nos arquivos tocados)**

Run: `pnpm lint:ci`
Expected: sem erros nos arquivos modificados nesta fase (débito pré-existente em outros módulos é aceitável).

- [ ] **Step 2: Push e PR**

```bash
git push -u origin feat/comboio-tanque-caminhao
gh pr create --base homolog --head feat/comboio-tanque-caminhao \
  --title "feat(comboio): capacidade do tanque do caminhão + validação no abastecimento" \
  --body "Adiciona capacidadeTanqueCaminhao ao equipamento e valida os litros do abastecimento pela capacidade do tanque-alvo (comboio = tanque do caminhão; demais = tanque do equipamento). Reabastecimento inalterado. Ver docs/superpowers/specs/2026-06-20-comboio-tanque-caminhao-design.md (no repo pwa-comboio)."
```

---

## Phase B — 360-repository (admin)

Diretório: `/Users/viniciusaguiar/Development/horautil/360-repository`

### Task B1: Camada de dados (`NovoEquip` + payload)

**Files:**
- Modify: `src/pages/prefeitura/sections/equipamentos/equipamentos-api.ts` (interface `NovoEquip` ~linha 47; `montarPayload` ~linha 345)

**Interfaces:**
- Produces: `NovoEquip.capacidadeTanqueCaminhao: number`; payload de criar/atualizar passa a enviar `capacidadeTanqueCaminhao`.

- [ ] **Step 1: Criar a branch a partir de homolog**

```bash
cd /Users/viniciusaguiar/Development/horautil/360-repository
git fetch origin
git checkout -b feat/comboio-tanque-caminhao origin/homolog
```

- [ ] **Step 2: Adicionar o campo à interface `NovoEquip`**

Em `equipamentos-api.ts`, logo após `capacidadeTanque: number;` (linha 47):

```ts
  /** Capacidade do tanque do próprio caminhão (L). Só p/ tipo Comboio. */
  capacidadeTanqueCaminhao: number;
```

- [ ] **Step 3: Enviar o campo no payload**

Em `montarPayload`, logo após `capacidadeTanque: input.capacidadeTanque,` (linha 345):

```ts
    capacidadeTanqueCaminhao: input.capacidadeTanqueCaminhao,
```

- [ ] **Step 4: Typecheck**

Run: `pnpm build`
Expected: vai **falhar** em `EquipamentoFormPage.tsx` porque o objeto `NovoEquip` montado lá ainda não tem `capacidadeTanqueCaminhao`. Isso é esperado; será resolvido na Task B2. (Se preferir um checkpoint verde, faça B1+B2 antes de buildar.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/prefeitura/sections/equipamentos/equipamentos-api.ts
git commit -m "feat(equipamentos): capacidadeTanqueCaminhao no modelo/payload do admin"
```

### Task B2: Formulário de equipamento (estado, edição, save e UI)

**Files:**
- Modify: `src/pages/prefeitura/sections/EquipamentoFormPage.tsx`

**Interfaces:**
- Consumes: `NovoEquip.capacidadeTanqueCaminhao` (Task B1).

- [ ] **Step 1: Campo no `FormState`**

Em `interface FormState`, após `capacidadeTanque: string;` (linha 56):

```ts
  capacidadeTanqueCaminhao: string;
```

- [ ] **Step 2: Valor inicial em `FORM_VAZIO`**

Após `capacidadeTanque: "",` (linha 95):

```ts
  capacidadeTanqueCaminhao: "",
```

- [ ] **Step 3: Carregar na edição (`paraFormState`)**

Após `capacidadeTanque: num(d.capacidadeTanque),` (linha 148):

```ts
    capacidadeTanqueCaminhao: num(d.capacidadeTanqueCaminhao),
```

- [ ] **Step 4: Incluir no objeto `NovoEquip` do `salvar()`**

Após `capacidadeTanque: asNumber(form.capacidadeTanque),` (linha 303). Só envia valor quando comboio; senão `0`:

```ts
        capacidadeTanqueCaminhao: ehComboio
          ? asNumber(form.capacidadeTanqueCaminhao)
          : 0,
```

- [ ] **Step 5: UI — rótulo dinâmico do campo existente + campo novo (só comboio)**

Substituir o campo de capacidade (linhas 459-461):

```tsx
          {texto("capacidadeTanque", "Capacidade do tanque (L)", {
            numeric: true,
          })}
```

por:

```tsx
          {texto(
            "capacidadeTanque",
            ehComboio ? "Capacidade do reservatório (L)" : "Capacidade do tanque (L)",
            { numeric: true },
          )}
          {ehComboio
            ? texto("capacidadeTanqueCaminhao", "Capacidade do tanque do caminhão (L)", {
                numeric: true,
              })
            : null}
```

- [ ] **Step 6: Build + lint + testes**

Run: `pnpm build && pnpm lint && pnpm test`
Expected: build sem erros de tipo; lint sem erros novos; testes (vitest) passam.

- [ ] **Step 7: Commit**

```bash
git add src/pages/prefeitura/sections/EquipamentoFormPage.tsx
git commit -m "feat(equipamentos): campo capacidade do tanque do caminhao no form (comboio)"
```

### Task B3: Push + PR (360)

- [ ] **Step 1: Push e PR**

```bash
git push -u origin feat/comboio-tanque-caminhao
gh pr create --base homolog --head feat/comboio-tanque-caminhao \
  --title "feat(equipamentos): capacidade do tanque do caminhão no cadastro de comboio" \
  --body "No cadastro/edição de equipamento tipo Comboio, adiciona o campo 'Capacidade do tanque do caminhão (L)' e renomeia o campo existente para 'Capacidade do reservatório (L)'. Envia capacidadeTanqueCaminhao ao backend. Depende do PR do back."
```

---

## Phase C — pwa-comboio (PWA do comboista)

Diretório: `/Users/viniciusaguiar/Development/horautil/pwa-comboio`
Branch `feat/comboio-tanque-caminhao` **já existe** (tem os docs de spec/plano).

### Task C1: Tipo + helper de teto por tipo (TDD)

**Files:**
- Modify: `lib/api/abastecimento.ts` (interface `EquipamentoApi` ~linha 15; helpers novos no fim)
- Test: `lib/api/abastecimento.test.ts` (novo)

**Interfaces:**
- Produces:
  - `EquipamentoApi.capacidadeTanqueCaminhao?: number`
  - `ehComboioTipo(tipo?: string): boolean`
  - `tetoAbastecimento(equip: Pick<EquipamentoApi, "tipo" | "capacidadeTanque" | "capacidadeTanqueCaminhao">): number`

- [ ] **Step 1: Adicionar o campo à interface `EquipamentoApi`**

Em `lib/api/abastecimento.ts`, após `capacidadeTanque?: number;` (linha 15):

```ts
  /** Capacidade do tanque do próprio caminhão (L) — só p/ comboio; 0/ausente = sem limite. */
  capacidadeTanqueCaminhao?: number;
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `lib/api/abastecimento.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { ehComboioTipo, tetoAbastecimento } from "./abastecimento";

describe("ehComboioTipo", () => {
  it("reconhece comboio ignorando caixa/espaços", () => {
    expect(ehComboioTipo("Comboio")).toBe(true);
    expect(ehComboioTipo("  comboio ")).toBe(true);
    expect(ehComboioTipo("Caminhões")).toBe(false);
    expect(ehComboioTipo(undefined)).toBe(false);
  });
});

describe("tetoAbastecimento", () => {
  it("comboio usa capacidadeTanqueCaminhao (não o reservatório)", () => {
    expect(
      tetoAbastecimento({
        tipo: "Comboio",
        capacidadeTanque: 5000,
        capacidadeTanqueCaminhao: 400,
      }),
    ).toBe(400);
  });

  it("equipamento comum usa capacidadeTanque", () => {
    expect(tetoAbastecimento({ tipo: "Caminhões", capacidadeTanque: 300 })).toBe(300);
  });

  it("0/ausente = sem limite (0)", () => {
    expect(tetoAbastecimento({ tipo: "Comboio", capacidadeTanqueCaminhao: 0 })).toBe(0);
    expect(tetoAbastecimento({ tipo: "Comboio" })).toBe(0);
    expect(tetoAbastecimento({ tipo: "Caminhões" })).toBe(0);
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `pnpm test -- abastecimento`
Expected: FAIL — `ehComboioTipo`/`tetoAbastecimento` não existem.

- [ ] **Step 4: Implementar os helpers**

No fim de `lib/api/abastecimento.ts`:

```ts
/** Comboio? (case-insensitive, igual ao back/360). */
export function ehComboioTipo(tipo?: string): boolean {
  return (tipo ?? "").trim().toLowerCase() === "comboio";
}

/**
 * Teto de litros (capacidade do tanque-alvo) ao abastecer um equipamento:
 * comboio → capacidadeTanqueCaminhao; demais → capacidadeTanque.
 * 0/ausente/inválida = 0 (sem limite).
 */
export function tetoAbastecimento(
  equip: Pick<
    EquipamentoApi,
    "tipo" | "capacidadeTanque" | "capacidadeTanqueCaminhao"
  >,
): number {
  const campo = ehComboioTipo(equip.tipo)
    ? equip.capacidadeTanqueCaminhao
    : equip.capacidadeTanque;
  const n = Number(campo);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `pnpm test -- abastecimento`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/api/abastecimento.ts lib/api/abastecimento.test.ts
git commit -m "feat(abastecer): helper de teto por tipo (comboio = tanque do caminhao)"
```

### Task C2: Usar o teto certo + aviso no `FuelFormScreen`

**Files:**
- Modify: `components/mobile/fuel-form-screen.tsx` (import ~linha 26; cap ~linha 113-114; aviso ~linha 338-343; mensagens ~237-240 e ~369-375)

**Interfaces:**
- Consumes: `ehComboioTipo`, `tetoAbastecimento` (Task C1).

- [ ] **Step 1: Importar os helpers**

Na linha de import de `@/lib/api/abastecimento` (hoje `import { ultimaLeituraAbastecimento } from "@/lib/api/abastecimento";`, linha 26), passar a importar também os helpers:

```ts
import {
  ehComboioTipo,
  tetoAbastecimento,
  ultimaLeituraAbastecimento,
} from "@/lib/api/abastecimento";
```

- [ ] **Step 2: Calcular o teto pelo tipo do alvo**

Substituir (linhas 113-114):

```ts
  const capEquip = equipSel?.capacidadeTanque ?? 0;
  const acimaCapacidade = capEquip > 0 && litrosNum > 0 && litrosNum > capEquip;
```

por:

```ts
  const alvoComboio = !!equipSel && ehComboioTipo(equipSel.tipo);
  const rotuloTanque = alvoComboio ? "tanque do caminhão" : "tanque do equipamento";
  const capEquip = equipSel ? tetoAbastecimento(equipSel) : 0;
  const acimaCapacidade = capEquip > 0 && litrosNum > 0 && litrosNum > capEquip;
```

- [ ] **Step 3: Mensagem de erro do submit usa o rótulo certo**

Substituir o bloco do `handleSubmit` (linhas 236-241):

```ts
    if (acimaCapacidade) {
      setErro(
        `Acima da capacidade do tanque do equipamento (${capEquip.toLocaleString("pt-BR")} L). Reduza os litros.`,
      );
      return;
    }
```

por:

```ts
    if (acimaCapacidade) {
      setErro(
        `Acima da capacidade do ${rotuloTanque} (${capEquip.toLocaleString("pt-BR")} L). Reduza os litros.`,
      );
      return;
    }
```

- [ ] **Step 4: Aviso inline da capacidade usa o rótulo certo**

Substituir o aviso inline (linhas 369-375):

```tsx
          {acimaCapacidade ? (
            <p className="flex items-start gap-1.5 text-xs text-amber-500">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Acima da capacidade do tanque do equipamento (
              {capEquip.toLocaleString("pt-BR")} L). Reduza os litros.
            </p>
          ) : null}
```

por:

```tsx
          {acimaCapacidade ? (
            <p className="flex items-start gap-1.5 text-xs text-amber-500">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Acima da capacidade do {rotuloTanque} (
              {capEquip.toLocaleString("pt-BR")} L). Reduza os litros.
            </p>
          ) : null}
```

- [ ] **Step 5: Aviso de que o alvo é o tanque do caminhão**

Logo após o parágrafo de ajuda do equipamento (o `<p>` que termina em `linhas 338-342`, fechando antes de `</div>` na linha 343), inserir:

```tsx
          {alvoComboio ? (
            <p className="text-xs font-medium text-brand">
              Abastecendo o tanque do caminhão do comboio.
            </p>
          ) : null}
```

- [ ] **Step 6: Lint + build + unit**

Run: `pnpm lint && pnpm build && pnpm test`
Expected: lint limpo; build (next build --webpack) sem erros; testes 100% verdes.

- [ ] **Step 7: Commit**

```bash
git add components/mobile/fuel-form-screen.tsx
git commit -m "feat(abastecer): abastecer o tanque do caminhao do comboio (teto + aviso)"
```

### Task C3: E2E + push + PR (pwa)

- [ ] **Step 1: Rodar a suíte E2E (regressão do app-shell offline)**

Run: `pnpm test:e2e`
Expected: 2/2 passam (a feature não mexe no offline; é um guard de regressão).

- [ ] **Step 2: Push e PR**

```bash
git push -u origin feat/comboio-tanque-caminhao
gh pr create --base homolog --head feat/comboio-tanque-caminhao \
  --title "feat(abastecer): abastecer o tanque do caminhão do comboio" \
  --body "Na tela Abastecer, ao informar a placa/chassi de um comboio, valida os litros pela capacidade do tanque do caminhão (capacidadeTanqueCaminhao) e mostra aviso. Detecção pelo tipo do alvo; payload inalterado. Inclui os docs de spec/plano. Depende dos PRs do back e do 360."
```

---

## Self-review (autor)

- **Cobertura do spec:** campo novo (A1/B1/B2/C1) ✓; regra de capacidade por tipo no back (A2/A3) ✓ e no pwa (C1/C2) ✓; admin com campo condicional + rótulo do reservatório (B2) ✓; aviso no PWA (C2) ✓; reabastecimento intocado ✓; origem flexível intocada ✓; sem mudança de payload ✓; branches/PRs por repo (A4/B3/C3) ✓.
- **Sem placeholders:** todos os passos têm o código real.
- **Consistência de tipos/nomes:** `capacidadeTanqueCaminhao` em back DTO, 360 `NovoEquip`/form, pwa `EquipamentoApi`; helpers `ehComboio`/`capacidadeAlvoAbastecimento` (back) e `ehComboioTipo`/`tetoAbastecimento` (pwa) — assinaturas batem entre definição e uso.
- **Ordem:** back → 360 → pwa (campo persistido antes dos consumidores). O sistema degrada com segurança se o campo ainda não existir (teto 0 = sem limite).
