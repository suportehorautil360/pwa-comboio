import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "../db";
import {
  cacheEntry,
  cacheGet,
  cachePut,
  isStale,
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
