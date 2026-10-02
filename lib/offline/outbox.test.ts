import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocka só o `api` do client; mantém o `ApiError` real (submit usa instanceof).
vi.mock("../api/client", async (orig) => {
  const actual = await orig<typeof import("../api/client")>();
  return {
    ...actual,
    api: { ...actual.api, post: vi.fn(), patch: vi.fn() },
  };
});

import { api, ApiError } from "../api/client";
import { db, type OutboxItem } from "../db";
import {
  backoffDelay,
  discardItem,
  ehRejeicaoDefinitiva,
  enqueue,
  flushOutbox,
  getCounts,
  itemParaLancamento,
  listItems,
  MAX_ATTEMPTS,
  migrarRotasAntigas,
  retryItem,
  submit,
} from "./outbox";

const post = api.post as unknown as ReturnType<typeof vi.fn>;

/** Item exibível (itemParaLancamento) — só precisa de kind/payload/failed. */
function viewItem(
  kind: OutboxItem["kind"],
  payload: unknown,
  failed = false,
): OutboxItem {
  return {
    id: "1",
    kind,
    path: "/x",
    method: "POST",
    payload,
    createdAt: 0,
    attempts: 0,
    nextAttemptAt: 0,
    failed,
  };
}

/** Semeia um evento diretamente no outbox (p/ exercitar o flush). */
async function seed(partial: Partial<OutboxItem>): Promise<string> {
  const id = partial.id ?? crypto.randomUUID();
  await db.outbox.put({
    id,
    kind: "abastecimento",
    path: "/abastecimentos",
    method: "POST",
    payload: { liters: 1 },
    createdAt: 0,
    attempts: 0,
    nextAttemptAt: 0,
    ...partial,
  });
  return id;
}

describe("itemParaLancamento", () => {
  it("mapeia abastecimento", () => {
    const r = itemParaLancamento(
      viewItem("abastecimento", { plateOrChassis: "ABC-1234", liters: 50 }),
    );
    expect(r).toMatchObject({
      kind: "abastecimento",
      code: "ABC-1234",
      description: "Abastecimento",
      value: "50 L",
      status: "pendente",
    });
  });

  it("mapeia lubrificação com contagem de pontos", () => {
    const r = itemParaLancamento(
      viewItem("lubrificacao", { plateOrChassis: "XYZ", greasedPoints: ["a", "b"] }),
    );
    expect(r).toMatchObject({ code: "XYZ", description: "2 pontos", value: "engraxe" });
  });

  it("mapeia reabastecimento", () => {
    const r = itemParaLancamento(viewItem("reabastecimento", { receivedLiters: 200 }));
    expect(r).toMatchObject({ code: "Comboio", value: "200 L" });
  });

  it("marca status 'erro' quando failed", () => {
    const r = itemParaLancamento(viewItem("abastecimento", { liters: 10 }, true));
    expect(r.status).toBe("erro");
  });
});

describe("backoffDelay", () => {
  it("cresce com as tentativas e respeita o teto", () => {
    const d1 = backoffDelay(1);
    expect(d1).toBeGreaterThanOrEqual(4000); // 5s ±20%
    expect(d1).toBeLessThanOrEqual(6000);
    // teto de 5min (±20% de jitter)
    expect(backoffDelay(20)).toBeLessThanOrEqual(360_000);
    expect(backoffDelay(20)).toBeGreaterThanOrEqual(240_000);
  });
});

describe("submit", () => {
  beforeEach(async () => {
    post.mockReset();
    await db.outbox.clear();
    vi.stubGlobal("navigator", { onLine: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("online + 2xx → synced:true, sem enfileirar, com Idempotency-Key", async () => {
    post.mockResolvedValueOnce({ data: { ok: true } });
    const r = await submit("abastecimento", { liters: 10 });
    expect(r).toEqual({ synced: true });
    expect(post).toHaveBeenCalledTimes(1);
    const [path, , opts] = post.mock.calls[0] as [
      string,
      unknown,
      { idempotencyKey?: string },
    ];
    expect(path).toBe("/abastecimentos");
    expect(typeof opts.idempotencyKey).toBe("string");
    expect((await getCounts()).pendentes).toBe(0);
  });

  it("online + 4xx (validação/saldo) → lança e NÃO enfileira", async () => {
    post.mockRejectedValueOnce(new ApiError(400, "Saldo insuficiente"));
    await expect(submit("abastecimento", { liters: 999 })).rejects.toThrow(
      /insuficiente/i,
    );
    expect((await getCounts()).pendentes).toBe(0);
  });

  it("online + 409 (idempotência transitória) → enfileira, synced:false", async () => {
    post.mockRejectedValueOnce(new ApiError(409, "processando"));
    const r = await submit("reabastecimento", { receivedLiters: 50 });
    expect(r).toEqual({ synced: false });
    expect((await getCounts()).pendentes).toBe(1);
  });

  it("online + 5xx → enfileira, synced:false", async () => {
    post.mockRejectedValueOnce(new ApiError(503, "fora do ar"));
    const r = await submit("lubrificacao", { greasedPoints: ["a"] });
    expect(r).toEqual({ synced: false });
    expect((await getCounts()).pendentes).toBe(1);
  });

  it("offline → nem tenta enviar, enfileira e synced:false", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const r = await submit("abastecimento", { liters: 10 });
    expect(r).toEqual({ synced: false });
    expect(post).not.toHaveBeenCalled();
    expect((await getCounts()).pendentes).toBe(1);
  });
});

// `editar-ponto` é um kind legado (a correção agora é uma solicitação), mas o
// path explícito no enqueue continua valendo para qualquer kind.
describe("enqueue com path dinâmico (editar-ponto)", () => {
  beforeEach(async () => {
    post.mockReset();
    await db.outbox.clear();
    vi.stubGlobal("navigator", { onLine: false });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("guarda o path informado no item da fila", async () => {
    await enqueue("editar-ponto", { timestampOriginal: "x" }, {
      path: "/time-records/update/abc",
    });
    const [item] = await listItems();
    expect(item.path).toBe("/time-records/update/abc");
    expect(item.kind).toBe("editar-ponto");
  });
});

describe("flushOutbox (backoff + dead-letter)", () => {
  beforeEach(async () => {
    post.mockReset();
    await db.outbox.clear();
    vi.stubGlobal("navigator", { onLine: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("2xx → remove o item da fila", async () => {
    await seed({ id: "ok" });
    post.mockResolvedValueOnce({});
    await flushOutbox();
    expect(await db.outbox.get("ok")).toBeUndefined();
  });

  it("ignora item com nextAttemptAt no futuro", async () => {
    await seed({ id: "later", nextAttemptAt: Date.now() + 60_000 });
    await flushOutbox();
    expect(post).not.toHaveBeenCalled();
    expect(await db.outbox.get("later")).toBeDefined();
  });

  it("5xx → incrementa attempts e agenda backoff (continua pendente, não failed)", async () => {
    await seed({ id: "retry", attempts: 0 });
    post.mockRejectedValueOnce(new ApiError(503, "fora do ar"));
    const antes = Date.now();
    await flushOutbox();
    const it = await db.outbox.get("retry");
    expect(it?.failed).toBeFalsy();
    expect(it?.attempts).toBe(1);
    expect(it?.nextAttemptAt).toBeGreaterThan(antes);
  });

  it("estouro de MAX_ATTEMPTS → marca failed (dead-letter)", async () => {
    await seed({ id: "dead", attempts: MAX_ATTEMPTS - 1 });
    post.mockRejectedValueOnce(new ApiError(503, "fora do ar"));
    await flushOutbox();
    const it = await db.outbox.get("dead");
    expect(it?.failed).toBe(true);
    expect((await getCounts()).falhos).toBe(1);
  });

  it("4xx → marca failed imediatamente (não reenvia sozinho)", async () => {
    await seed({ id: "bad" });
    post.mockRejectedValueOnce(new ApiError(422, "payload inválido"));
    await flushOutbox();
    const it = await db.outbox.get("bad");
    expect(it?.failed).toBe(true);
    expect(it?.lastError).toMatch(/inválido/i);
  });
});

describe("retryItem / discardItem (dead-letter UI)", () => {
  beforeEach(async () => {
    post.mockReset();
    await db.outbox.clear();
    vi.stubGlobal("navigator", { onLine: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("retryItem volta um item failed para pendente e elegível", async () => {
    await seed({ id: "r", failed: true, attempts: 3, nextAttemptAt: Date.now() + 1e9 });
    await retryItem("r");
    const it = await db.outbox.get("r");
    expect(it?.failed).toBeFalsy();
    expect(it?.nextAttemptAt).toBeLessThanOrEqual(Date.now());
    expect((await getCounts()).pendentes).toBe(1);
  });

  it("discardItem remove o item da fila", async () => {
    await seed({ id: "d", failed: true });
    await discardItem("d");
    expect(await db.outbox.get("d")).toBeUndefined();
  });
});

// A rota de batida aceita 10 requisições por minuto. Uma fila com mais batidas
// que isso (dias sem sinal) não pode mandar o excedente para os erros.
describe("limite de requisições (429)", () => {
  beforeEach(async () => {
    post.mockReset();
    await db.outbox.clear();
    vi.stubGlobal("navigator", { onLine: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("flush: não é erro do item — espera, não gasta tentativa e para o lote", async () => {
    await seed({ id: "a", createdAt: 1, attempts: 2 });
    await seed({ id: "b", createdAt: 2 });
    post.mockRejectedValueOnce(new ApiError(429, "ThrottlerException: Too Many Requests"));
    const antes = Date.now();

    await flushOutbox();

    const a = await db.outbox.get("a");
    expect(a?.failed).toBeFalsy();
    expect(a?.attempts).toBe(2);
    expect(a?.nextAttemptAt).toBeGreaterThanOrEqual(antes + 60_000);
    // O segundo nem foi tentado: bateria no mesmo limite.
    expect(post).toHaveBeenCalledTimes(1);
    expect(await db.outbox.get("b")).toBeDefined();
  });

  it("nem no último fôlego vira dead-letter por causa do limite", async () => {
    await seed({ id: "a", attempts: MAX_ATTEMPTS - 1 });
    post.mockRejectedValueOnce(new ApiError(429, "Too Many Requests"));
    await flushOutbox();
    expect((await db.outbox.get("a"))?.failed).toBeFalsy();
  });

  it("submit: enfileira em vez de mostrar erro e perder o lançamento", async () => {
    post.mockRejectedValueOnce(new ApiError(429, "Too Many Requests"));
    const r = await submit("ponto", { tipo: "entrada" });
    expect(r).toEqual({ synced: false });
    expect((await getCounts()).pendentes).toBe(1);
  });

  it("ehRejeicaoDefinitiva separa o que adianta reenviar do que não adianta", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(ehRejeicaoDefinitiva(new ApiError(status, "x"))).toBe(true);
    }
    for (const status of [408, 409, 429, 500, 503]) {
      expect(ehRejeicaoDefinitiva(new ApiError(status, "x"))).toBe(false);
    }
    expect(ehRejeicaoDefinitiva(new TypeError("Failed to fetch"))).toBe(false);
  });
});

// O back removeu `/time-records` (404). A batida feita sem sinal ia para os
// erros de sincronização e nunca chegava ao RH. Ela tem de subir pela rota
// nova sozinha, sem o comboísta refazer nada.
describe("batida presa na rota antiga do ponto", () => {
  const BATIDA = {
    name: "João Comboísta",
    photo: "data:image/jpeg;base64,AAAA",
    prefeituraId: "pref-1",
    timestampOriginal: "2026-09-28T10:00:00.000Z",
    tipo: "entrada",
    cpf: "12345678901",
  };

  beforeEach(async () => {
    post.mockReset();
    await db.outbox.clear();
    vi.stubGlobal("navigator", { onLine: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("batida nova já nasce na rota que existe", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await enqueue("ponto", BATIDA);
    const [item] = await listItems();
    expect(item.path).toBe("/checklist/bater-ponto");
  });

  it("o flush tira a batida dos erros e a envia pela rota nova, com a mesma chave", async () => {
    await seed({
      id: "presa",
      kind: "ponto",
      path: "/time-records",
      payload: BATIDA,
      failed: true,
      attempts: 1,
      idempotencyKey: "chave-presa",
      lastError: "Cannot POST /time-records",
    });
    post.mockResolvedValueOnce({ data: { id: "pk-1" } });

    await flushOutbox();

    expect(post).toHaveBeenCalledTimes(1);
    const [path, corpo, opts] = post.mock.calls[0] as [
      string,
      unknown,
      { idempotencyKey?: string },
    ];
    expect(path).toBe("/checklist/bater-ponto");
    // O horário é o que a pessoa bateu, não o de agora.
    expect(corpo).toEqual(BATIDA);
    expect(opts.idempotencyKey).toBe("chave-presa");
    expect(await db.outbox.get("presa")).toBeUndefined();
    expect(await getCounts()).toEqual({ pendentes: 0, falhos: 0 });
  });

  it("sem sinal, a batida continua guardada — nada se perde", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await seed({ id: "presa", kind: "ponto", path: "/time-records", payload: BATIDA, failed: true });

    await flushOutbox();

    expect(post).not.toHaveBeenCalled();
    expect(await db.outbox.get("presa")).toBeDefined();
  });

  it("migrarRotasAntigas não mexe numa fila que não tem item antigo", async () => {
    await seed({ id: "ok" });
    expect(await migrarRotasAntigas()).toBe(0);
    expect((await db.outbox.get("ok"))?.path).toBe("/abastecimentos");
  });

  it("os outros lançamentos presos por erro de verdade continuam nos erros", async () => {
    await seed({ id: "ruim", failed: true, lastError: "payload inválido" });
    await seed({ id: "presa", kind: "ponto", path: "/time-records", payload: BATIDA, failed: true });
    post.mockResolvedValueOnce({ data: { id: "pk-1" } });

    await flushOutbox();

    expect((await db.outbox.get("ruim"))?.failed).toBe(true);
    expect(await db.outbox.get("presa")).toBeUndefined();
  });
});
