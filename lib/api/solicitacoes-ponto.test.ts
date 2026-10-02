import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (orig) => {
  const actual = await orig<typeof import("./client")>();
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

import { api } from "./client";
import { solicitacoesPontoApi } from "./solicitacoes-ponto";

const get = api.get as unknown as ReturnType<typeof vi.fn>;

// Sem recorte a rota devolve as solicitações da EMPRESA inteira — nome, CPF e
// atestado dos colegas —, e a resposta fica guardada neste aparelho.
describe("solicitacoesPontoApi.listar", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: [] });
  });

  it("pede só as da pessoa, pelo CPF (só dígitos)", async () => {
    await solicitacoesPontoApi.listar("pref-1", {
      cpf: "123.456.789-01",
      nome: "João",
    });
    expect(get).toHaveBeenCalledWith("/solicitacoes-ponto/pref-1?cpf=12345678901");
  });

  it("sem CPF, recorta pelo nome", async () => {
    await solicitacoesPontoApi.listar("pref-1", { nome: " João da Silva " });
    expect(get).toHaveBeenCalledWith(
      "/solicitacoes-ponto/pref-1?nome=Jo%C3%A3o%20da%20Silva",
    );
  });

  // `?nome=` vazio faz o back devolver lista vazia, nunca a empresa inteira.
  it("sem identidade nenhuma, ainda assim manda o recorte", async () => {
    await solicitacoesPontoApi.listar("pref-1", {});
    expect(get).toHaveBeenCalledWith("/solicitacoes-ponto/pref-1?nome=");
  });

  it("resposta sem lista vira lista vazia", async () => {
    get.mockResolvedValueOnce({});
    expect(await solicitacoesPontoApi.listar("pref-1", { cpf: "1" })).toEqual([]);
  });
});
