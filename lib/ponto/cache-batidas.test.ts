import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const sessao = vi.hoisted(() => ({
  user: null as null | Record<string, string>,
}));
vi.mock("../session", async (orig) => {
  const actual = await orig<typeof import("../session")>();
  return { ...actual, getSessionUser: () => sessao.user };
});

import { cacheEntry, cacheGet } from "../data/cache";
import { db } from "../db";
import { guardarBatidaEnviada } from "./cache-batidas";

const JOAO = {
  nome: "João Comboísta",
  usuario: "joao123",
  perfil: "Comboísta",
  vinculo: "operador",
  prefeituraId: "pref-1",
  cpf: "123.456.789-01",
  funcionarioId: "f-1",
};
const CHAVE = "ponto:pref-1:f-1";

/** Corpo do POST /checklist/bater-ponto. */
function resposta(partial: Record<string, unknown> = {}) {
  return {
    data: {
      id: "pk-1",
      name: "João Comboísta",
      prefeituraId: "pref-1",
      timestampOriginal: "2026-09-28T10:00:00.000Z",
      tipo: "entrada",
      photo: "data:image/jpeg;base64,AAAA",
      cpf: "12345678901",
      nsr: 42,
      hash: "h".repeat(64),
      registro: "original",
      aplicado: true,
      ...partial,
    },
    message: "Batida registrada.",
  };
}

describe("guardarBatidaEnviada", () => {
  beforeEach(async () => {
    await db.cache.clear();
    sessao.user = JOAO;
  });

  // Sem isto a linha do dia voltava a "Sem registro" entre a batida sair da
  // fila e a próxima leitura do servidor — com o botão Bater à mostra.
  it("a batida que subiu entra na folha guardada, com NSR e hash", async () => {
    await guardarBatidaEnviada(resposta());

    const lista = await cacheGet<Record<string, unknown>[]>(CHAVE);
    expect(lista).toHaveLength(1);
    expect(lista?.[0]).toMatchObject({ id: "pk-1", tipo: "entrada", nsr: 42 });
  });

  it("a selfie não vai para o cache", async () => {
    await guardarBatidaEnviada(resposta());
    const [b] = (await cacheGet<Record<string, unknown>[]>(CHAVE)) ?? [];
    expect(b).not.toHaveProperty("photo");
  });

  it("soma ao que já estava, sem repetir e sem rejuvenescer o cache", async () => {
    await db.cache.put({ key: CHAVE, data: [{ id: "pk-0" }], cachedAt: 500 });

    await guardarBatidaEnviada(resposta());
    await guardarBatidaEnviada(resposta());

    const entry = await cacheEntry<{ id: string }[]>(CHAVE);
    expect(entry?.data.map((b) => b.id)).toEqual(["pk-0", "pk-1"]);
    expect(entry?.cachedAt).toBe(500);
  });

  // A fila é do aparelho: a batida de quem usou antes pode subir com outro
  // login aberto, e não pode aparecer na folha dele.
  it("batida de outra pessoa não entra na folha de quem está logado", async () => {
    await guardarBatidaEnviada(resposta({ cpf: "98765432100", name: "Maria" }));
    expect(await cacheGet(CHAVE)).toBeUndefined();
  });

  it("sem CPF na sessão, compara pelo nome", async () => {
    sessao.user = { ...JOAO, cpf: "" };
    await guardarBatidaEnviada(resposta({ cpf: null, name: " joão comboísta " }));
    expect(await cacheGet(CHAVE)).toHaveLength(1);
  });

  it("resposta sem batida, ou sem sessão, não faz nada", async () => {
    await guardarBatidaEnviada({});
    await guardarBatidaEnviada(null);
    sessao.user = null;
    await guardarBatidaEnviada(resposta());
    expect(await db.cache.count()).toBe(0);
  });
});
