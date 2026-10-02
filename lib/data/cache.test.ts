import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "../db";
import {
  cacheEntry,
  cacheGet,
  cachePatch,
  cachePut,
  isStale,
  limparCachesAntigos,
  subscribeCache,
} from "./cache";

describe("subscribeCache", () => {
  beforeEach(async () => {
    await db.cache.clear();
  });

  it("notifica a chave gravada a cada cachePut, e para após unsub", async () => {
    const chaves: string[] = [];
    const unsub = subscribeCache((k) => chaves.push(k));
    await cachePut("k1", 1);
    await cachePut("k2", 2);
    unsub();
    await cachePut("k3", 3);
    expect(chaves).toEqual(["k1", "k2"]);
  });
});

describe("isStale", () => {
  it("fresco dentro do TTL, stale fora ou sem cache", () => {
    const now = Date.now();
    expect(isStale(now, 60_000)).toBe(false);
    expect(isStale(now - 120_000, 60_000)).toBe(true);
    expect(isStale(undefined, 60_000)).toBe(true);
  });
});

describe("cacheGet / cachePut", () => {
  beforeEach(async () => {
    await db.cache.clear();
  });

  it("retorna undefined quando não há cache", async () => {
    expect(await cacheGet("x:1")).toBeUndefined();
  });

  it("roundtrip: grava e lê o mesmo dado", async () => {
    await cachePut("equip:p1", [{ id: "a" }]);
    expect(await cacheGet("equip:p1")).toEqual([{ id: "a" }]);
  });

  it("sobrescreve e atualiza cachedAt", async () => {
    await cachePut("k", 1);
    const t1 = (await db.cache.get("k"))!.cachedAt;
    await cachePut("k", 2);
    const row = await db.cache.get("k");
    expect(row!.data).toBe(2);
    expect(row!.cachedAt).toBeGreaterThanOrEqual(t1);
  });

  it("cacheEntry devolve data + cachedAt numa leitura só", async () => {
    expect(await cacheEntry("vazio")).toBeUndefined();
    await cachePut("e", { n: 7 });
    const entry = await cacheEntry<{ n: number }>("e");
    expect(entry?.data).toEqual({ n: 7 });
    expect(typeof entry?.cachedAt).toBe("number");
  });
});

describe("cachePatch (emenda local, sem parecer resposta do servidor)", () => {
  beforeEach(async () => {
    await db.cache.clear();
  });

  it("troca o dado e mantém a idade do cache — a revalidação segue no prazo", async () => {
    await db.cache.put({ key: "k", data: [1], cachedAt: 1000 });
    await cachePatch<number[]>("k", (atual) => [...(atual ?? []), 2]);
    expect(await cacheEntry("k")).toEqual({ data: [1, 2], cachedAt: 1000 });
  });

  it("chave que nunca foi lida nasce vencida: a próxima tela busca o servidor", async () => {
    await cachePatch<number[]>("nova", () => [1]);
    const entry = await cacheEntry("nova");
    expect(entry?.data).toEqual([1]);
    expect(isStale(entry?.cachedAt, 60_000)).toBe(true);
  });

  it("devolver undefined não grava nem notifica", async () => {
    const chaves: string[] = [];
    const unsub = subscribeCache((k) => chaves.push(k));
    await cachePatch<number[]>("k", () => undefined);
    unsub();
    expect(await cacheGet("k")).toBeUndefined();
    expect(chaves).toEqual([]);
  });

  it("avisa a tela montada", async () => {
    const chaves: string[] = [];
    const unsub = subscribeCache((k) => chaves.push(k));
    await cachePatch<number[]>("k", () => [1]);
    unsub();
    expect(chaves).toEqual(["k"]);
  });
});

// As chaves antigas guardavam o ponto e as solicitações da EMPRESA inteira —
// nome, CPF e atestado dos colegas — no aparelho de uma pessoa.
describe("limparCachesAntigos", () => {
  beforeEach(async () => {
    await db.cache.clear();
  });

  it("apaga os caches por empresa e deixa os de hoje", async () => {
    await cachePut("time-records:p1", [{ cpf: "de todos" }]);
    await cachePut("solicitacoes:p1", [{ anexoDataUrl: "atestado" }]);
    await cachePut("ponto:p1:f1", [{ id: "minha" }]);
    await cachePut("minhas-solicitacoes:p1:f1", [{ id: "s1" }]);
    await cachePut("equipamentos:p1", []);

    await limparCachesAntigos();

    expect(await cacheGet("time-records:p1")).toBeUndefined();
    expect(await cacheGet("solicitacoes:p1")).toBeUndefined();
    expect(await cacheGet("ponto:p1:f1")).toEqual([{ id: "minha" }]);
    expect(await cacheGet("minhas-solicitacoes:p1:f1")).toEqual([{ id: "s1" }]);
    expect(await cacheGet("equipamentos:p1")).toEqual([]);
  });
});
