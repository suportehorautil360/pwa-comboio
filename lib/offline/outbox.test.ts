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
  enqueue,
  flushOutbox,
  getCounts,
  itemParaLancamento,
  listItems,
  MAX_ATTEMPTS,
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
