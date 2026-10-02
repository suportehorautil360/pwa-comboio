/**
 * Migração da fila: itens gravados para rotas que o back não tem mais.
 *
 * O ponto do comboio mandava a batida para `POST /time-records` e a correção
 * de horário para `POST /time-records/update/:id`. O back removeu esse módulo
 * e as duas respondem 404 — e 404 é "rejeição definitiva" para a fila, então a
 * batida feita sem sinal ia para os erros de sincronização e nunca chegava ao
 * RH. Ela continua no aparelho, com a selfie e o horário em que foi batida.
 *
 * Aqui cada item antigo é reescrito para a rota de hoje e volta a ficar
 * elegível, **sem o comboísta refazer nada**:
 *
 * - batida → `POST /checklist/bater-ponto`, mesmo corpo. O horário é o do
 *   aparelho (`timestampOriginal`), então a batida de três semanas atrás entra
 *   com a data em que foi feita.
 * - correção de horário → `POST /solicitacoes-ponto` com `tipo: "corrigir"`.
 *
 * Funções puras: recebem a fila e devolvem só os itens que mudaram.
 */
import { OUTBOX_PATHS, type OutboxItem } from "../db";

const ROTA_ANTIGA = "/time-records";
const ROTA_ANTIGA_EDITAR = "/time-records/update/";

/** Quem está logado — a solicitação de correção precisa dizer de quem é. */
export interface QuemMigra {
  prefeituraId: string;
  nome: string;
  cpf?: string;
}

/** O item aponta para uma rota removida do back? */
export function precisaMigrar(item: Pick<OutboxItem, "path">): boolean {
  return item.path === ROTA_ANTIGA || item.path.startsWith(`${ROTA_ANTIGA}/`);
}

export const ERRO_BATIDA_REPETIDA =
  "Batida repetida: já há outra do mesmo tipo neste dia. A primeira foi enviada; descarte esta.";

function campos(item: OutboxItem): Record<string, unknown> {
  return item.payload && typeof item.payload === "object"
    ? (item.payload as Record<string, unknown>)
    : {};
}

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Instante da batida: o do corpo; na falta, o de quando entrou na fila. */
function instante(item: OutboxItem): number {
  const t = Date.parse(texto(campos(item).timestampOriginal));
  return Number.isNaN(t) ? item.createdAt : t;
}

/** `YYYY-MM-DD` no fuso do aparelho — o dia em que a pessoa bateu. */
function diaLocal(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** pessoa + tipo + dia: duas batidas com a mesma chave são a mesma marcação. */
function chaveDaBatida(item: OutboxItem): string {
  const p = campos(item);
  const pessoa =
    texto(p.cpf).replace(/\D/g, "") || texto(p.name).trim().toLowerCase();
  return `${pessoa}|${texto(p.tipo)}|${diaLocal(instante(item))}`;
}

/** Zera o estado de envio: o item volta à fila como se tivesse acabado de entrar. */
function reabrir(item: OutboxItem): OutboxItem {
  return {
    ...item,
    failed: false,
    attempts: 0,
    nextAttemptAt: 0,
    lastError: undefined,
    // A rota nova EXIGE a chave. Item herdado do banco v1 pode não ter; o id do
    // item é estável entre reenvios, que é tudo o que a chave precisa ser.
    idempotencyKey: item.idempotencyKey ?? item.id,
  };
}

/**
 * Reescreve os itens da fila que apontam para rotas removidas. Devolve só os
 * que mudaram (para um `bulkPut`); fila sem item antigo devolve lista vazia.
 *
 * **Batida repetida não sobe duas vezes.** Depois que a batida ia para os
 * erros, a linha do dia voltava a "Sem registro" e a pessoa podia bater de
 * novo. A rota de hoje não recusa o mesmo tipo no mesmo dia, e batida dupla no
 * ledger é registro legal errado, que não se apaga. Por pessoa + tipo + dia,
 * sobe a PRIMEIRA (o horário em que ela bateu de fato); as outras ficam nos
 * erros de sincronização, com o motivo, para ela descartar.
 *
 * A correção de horário precisa de quem pede (`quem`). Sem sessão ela fica
 * como está e é migrada na próxima vez que houver alguém logado.
 */
export function migrarFila(
  itens: OutboxItem[],
  quem: QuemMigra | null,
): OutboxItem[] {
  const mudados: OutboxItem[] = [];

  // Batidas que já estão na rota nova e ainda vão subir ocupam o seu dia.
  const ocupadas = new Set(
    itens
      .filter((i) => i.kind === "ponto" && !i.failed && !precisaMigrar(i))
      .map(chaveDaBatida),
  );

  const batidas = itens
    .filter((i) => i.path === ROTA_ANTIGA)
    .sort((a, b) => instante(a) - instante(b));

  for (const item of batidas) {
    const base: OutboxItem = {
      ...reabrir(item),
      kind: "ponto",
      path: OUTBOX_PATHS.ponto as string,
      method: "POST",
    };
    const chave = chaveDaBatida(item);
    if (ocupadas.has(chave)) {
      mudados.push({ ...base, failed: true, lastError: ERRO_BATIDA_REPETIDA });
      continue;
    }
    ocupadas.add(chave);
    mudados.push(base);
  }

  for (const item of itens) {
    if (!item.path.startsWith(ROTA_ANTIGA_EDITAR)) continue;
    if (!quem) continue;
    const batidaId = decodeURIComponent(
      item.path.slice(ROTA_ANTIGA_EDITAR.length),
    );
    const p = campos(item);
    const motivo = texto(p.motivo).trim();
    mudados.push({
      ...reabrir(item),
      kind: "solicitacao",
      path: OUTBOX_PATHS.solicitacao as string,
      method: "POST",
      payload: {
        tipo: "corrigir",
        prefeituraId: quem.prefeituraId,
        name: quem.nome,
        ...(quem.cpf ? { cpf: quem.cpf } : {}),
        batidaId,
        timestampOriginal: texto(p.timestampOriginal),
        ...(motivo ? { observacao: motivo } : {}),
      },
    });
  }

  return mudados;
}
