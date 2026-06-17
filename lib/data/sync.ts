/**
 * Orquestrador de sincronização (offline-first). Diferente do `useCached` (que
 * revalida um recurso quando a tela monta), o `syncAll` revalida TODOS os
 * recursos do operador de uma vez:
 *
 * - no **login** e ao **reconectar** → pré-aquece o cache, então toda tela
 *   funciona offline mesmo sem ter sido visitada antes;
 * - em **foco/intervalo** → mantém os dados frescos em background.
 *
 * Também esvazia a outbox. Grava nas MESMAS chaves que os hooks lêem
 * ({@link cacheKeys}). Respeita o TTL por recurso (não rebusca o que está
 * fresco) e nunca apaga o cache em falha de rede.
 *
 * Obs.: o pull ainda é full-replace por entidade — reduzir para o *delta*
 * depende do back expor `?updatedSince=` (ver docs/OFFLINE_FIRST_SPEC.md).
 */
import {
  listarEquipamentos,
  listarPostos,
} from "../api/abastecimento";
import { abonosApi } from "../api/abonos";
import { listarComboiosDoMotorista } from "../api/comboios";
import { configuracoesApi } from "../api/configuracoes";
import { getHistorico, getUltimosLancamentos } from "../api/dashboard";
import { escalaApi } from "../api/escala";
import { pontoApi } from "../api/ponto";
import { solicitacoesPontoApi } from "../api/solicitacoes-ponto";
import { provisionarRoster } from "../auth/roster";
import { flushOutbox } from "../offline/outbox";
import type { SessionUser } from "../session";
import { cacheEntry, cachePut, isStale } from "./cache";
import { cacheKeys } from "./cache-keys";

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/** Decide se um recurso deve ser revalidado agora. Pura — testável. */
export function shouldSync(
  cachedAt: number | undefined,
  ttl: number,
  force: boolean,
  online: boolean,
): boolean {
  if (!online) return false;
  if (force) return true;
  return isStale(cachedAt, ttl);
}

interface Resource {
  key: (u: SessionUser) => string | null;
  fetch: (u: SessionUser) => Promise<unknown>;
  ttl: number;
}

const RESOURCES: Resource[] = [
  {
    key: (u) => cacheKeys.comboios(u.prefeituraId, u.funcionarioId),
    fetch: (u) => listarComboiosDoMotorista(u.prefeituraId, u.funcionarioId!),
    ttl: 5 * MIN,
  },
  {
    key: (u) => cacheKeys.equipamentos(u.prefeituraId),
    fetch: (u) => listarEquipamentos(u.prefeituraId),
    ttl: DIA,
  },
  {
    key: (u) => cacheKeys.postos(u.prefeituraId),
    fetch: (u) => listarPostos(u.prefeituraId),
    ttl: DIA,
  },
  {
    key: (u) => cacheKeys.ultimos(u.prefeituraId),
    fetch: (u) => getUltimosLancamentos(u.prefeituraId),
    ttl: 2 * MIN,
  },
  {
    key: (u) => cacheKeys.historico(u.prefeituraId),
    fetch: (u) => getHistorico(u.prefeituraId),
    ttl: 2 * MIN,
  },
  {
    key: (u) => cacheKeys.timeRecords(u.prefeituraId),
    fetch: (u) => pontoApi.listar(u.prefeituraId),
    ttl: 2 * MIN,
  },
  {
    key: (u) => cacheKeys.escala(u.prefeituraId),
    fetch: (u) => escalaApi.obter(u.prefeituraId),
    ttl: DIA,
  },
  {
    key: (u) => cacheKeys.abonos(u.prefeituraId),
    fetch: (u) => abonosApi.listar(u.prefeituraId),
    ttl: 5 * MIN,
  },
  {
    key: (u) => cacheKeys.empresa(u.prefeituraId),
    fetch: (u) => configuracoesApi.obterEmpresa(u.prefeituraId),
    ttl: DIA,
  },
  {
    key: (u) => cacheKeys.solicitacoes(u.prefeituraId),
    fetch: (u) => solicitacoesPontoApi.listar(u.prefeituraId),
    ttl: 5 * MIN,
  },
];

let sincronizando = false;

/**
 * Esvazia a outbox e revalida todos os recursos do operador (em paralelo). Com
 * `force`, ignora o TTL (use ao logar e ao reconectar). Best-effort — não lança.
 */
export async function syncAll(
  user: SessionUser | null,
  opts?: { force?: boolean },
): Promise<void> {
  await flushOutbox();
  if (!user) return;
  const online = typeof navigator === "undefined" || navigator.onLine;
  if (!online || sincronizando) return;
  sincronizando = true;
  try {
    await Promise.all([
      // Pré-cacheia os verificadores p/ login offline multiusuário (só ao
      // logar/reconectar — dado sensível, não a cada foco).
      opts?.force
        ? provisionarRoster(user.prefeituraId)
        : Promise.resolve(),
      ...RESOURCES.map(async (r) => {
        const key = r.key(user);
        if (!key) return;
        const entry = await cacheEntry(key);
        if (!shouldSync(entry?.cachedAt, r.ttl, opts?.force ?? false, online)) {
          return;
        }
        try {
          await cachePut(key, await r.fetch(user));
        } catch {
          /* offline/erro: mantém o cache anterior */
        }
      }),
    ]);
  } finally {
    sincronizando = false;
  }
}
