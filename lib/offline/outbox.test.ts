import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocka só o `api` do client; mantém o `ApiError` real (submit usa instanceof).
vi.mock("../api/client", async (orig) => {
  const actual = await orig<typeof import("../api/client")>();
  return { ...actual, api: { ...actual.api, post: vi.fn() } };
});

import { api, ApiError } from "../api/client";
import {
  getCounts,
  itemParaLancamento,
  submit,
  type OutboxItem,
} from "./outbox";

const post = api.post as unknown as ReturnType<typeof vi.fn>;

function item(
  kind: OutboxItem["kind"],
  payload: unknown,
  failed = false,
): OutboxItem {
  return { id: "1", kind, payload, createdAt: 0, attempts: 0, failed };
}

describe("itemParaLancamento", () => {
  it("mapeia abastecimento", () => {
    const r = itemParaLancamento(
      item("abastecimento", { plateOrChassis: "ABC-1234", liters: 50 }),
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
      item("lubrificacao", { plateOrChassis: "XYZ", greasedPoints: ["a", "b"] }),
    );
    expect(r).toMatchObject({ code: "XYZ", description: "2 pontos", value: "engraxe" });
  });

  it("mapeia reabastecimento", () => {
    const r = itemParaLancamento(item("reabastecimento", { receivedLiters: 200 }));
    expect(r).toMatchObject({ code: "Comboio", value: "200 L" });
  });

  it("mapeia ponto", () => {
    const r = itemParaLancamento(item("ponto", { tipo: "entrada" }));
    expect(r).toMatchObject({ kind: "ponto", code: "entrada", value: "ponto" });
  });

  it("marca status 'erro' quando failed", () => {
    const r = itemParaLancamento(item("abastecimento", { liters: 10 }, true));
    expect(r.status).toBe("erro");
  });
});

// --- IndexedDB em memória (o env de teste é node, sem IDB) ---
function fakeIndexedDB() {
  const stores: Record<string, Map<string, unknown>> = {};
  type Req = {
    onsuccess: ((e?: unknown) => void) | null;
    onerror: ((e?: unknown) => void) | null;
    result?: unknown;
    error?: unknown;
  };
  const makeReq = (resultFn: () => unknown): Req => {
    const req: Req = { onsuccess: null, onerror: null };
    setTimeout(() => {
      try {
        req.result = resultFn();
        req.onsuccess?.();
      } catch (e) {
        req.error = e;
        req.onerror?.();
      }
    }, 0);
    return req;
  };
  const makeStore = (name: string) => {
    const map = stores[name] ?? (stores[name] = new Map());
    return {
      add: (it: { id: string }) => makeReq(() => void map.set(it.id, it)),
      put: (it: { id: string }) => makeReq(() => void map.set(it.id, it)),
      delete: (id: string) => makeReq(() => void map.delete(id)),
      getAll: () => makeReq(() => [...map.values()]),
    };
  };
  const db = {
    objectStoreNames: { contains: (n: string) => n in stores },
    createObjectStore: (n: string) => makeStore(n),
    transaction: () => {
      const tx: { oncomplete: (() => void) | null; objectStore: (n: string) => unknown } = {
        oncomplete: null,
        objectStore: (n: string) => makeStore(n),
      };
      setTimeout(() => tx.oncomplete?.(), 0);
      return tx;
    },
    close: () => {},
  };
  return {
    open: () => {
      const req: {
        onupgradeneeded: (() => void) | null;
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        result: typeof db;
      } = { onupgradeneeded: null, onsuccess: null, onerror: null, result: db };
      setTimeout(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

describe("submit", () => {
  beforeEach(() => {
    post.mockReset();
    vi.stubGlobal("indexedDB", fakeIndexedDB());
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
    const [path, , opts] = post.mock.calls[0] as [string, unknown, { idempotencyKey?: string }];
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
