import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (orig) => {
  const actual = await orig<typeof import("./client")>();
  return {
    ...actual,
    api: { ...actual.api, get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  };
});

const sessao = vi.hoisted(() => ({
  user: null as null | {
    nome: string;
    usuario: string;
    perfil: string;
    vinculo: string;
    prefeituraId: string;
    cpf?: string;
    funcionarioId?: string;
  },
}));
vi.mock("../session", async (orig) => {
  const actual = await orig<typeof import("../session")>();
  return { ...actual, getSessionUser: () => sessao.user };
});

import { db } from "../db";
import { api } from "./client";
import {
  janelasDeMeses,
  mesMaisAntigo,
  MESES_DE_HISTORICO,
  paraPontoRegistro,
  pontoApi,
} from "./ponto";

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;

const JOAO = {
  nome: "João Comboísta",
  usuario: "joao123",
  perfil: "Comboísta",
  vinculo: "operador",
  prefeituraId: "pref-1",
  cpf: "12345678901",
  funcionarioId: "f-1",
};

function linha(partial: Record<string, unknown> = {}) {
  return {
    id: "pk-1",
    legacyId: "aparelho-1",
    nsr: 42,
    hash: "h".repeat(64),
    tipo: "entrada",
    timestampOriginal: "2026-09-28T10:00:00.000Z",
    operatorNome: "João Comboísta",
    operatorCpf: "12345678901",
    registro: "original",
    refNsr: null,
    refId: null,
    aplicado: true,
    motivo: null,
    motivoReprovacao: null,
    createdAt: "2026-09-28T10:00:01.000Z",
    ...partial,
  };
}

describe("paraPontoRegistro", () => {
  it("leva nome, CPF, NSR e hash — o que o comprovante imprime", () => {
    const r = paraPontoRegistro(linha(), "pref-1");
    expect(r).toMatchObject({
      id: "pk-1",
      legacyId: "aparelho-1",
      name: "João Comboísta",
      cpf: "12345678901",
      prefeituraId: "pref-1",
      tipo: "entrada",
      nsr: 42,
      hash: "h".repeat(64),
      registro: "original",
    });
  });

  it("preserva o horário batido quando o RH aprovou uma correção", () => {
    const r = paraPontoRegistro(
      linha({
        timestampOriginal: "2026-09-28T10:20:00.000Z",
        horarioAnterior: "2026-09-28T10:00:00.000Z",
      }),
      "pref-1",
    );
    expect(r.timestampOriginal).toBe("2026-09-28T10:20:00.000Z");
    expect(r.horarioAnterior).toBe("2026-09-28T10:00:00.000Z");
  });

  it("batida incluída pelo RH (ajuste sem alvo) continua sendo ajuste", () => {
    const r = paraPontoRegistro(linha({ registro: "ajuste" }), "pref-1");
    expect(r.registro).toBe("ajuste");
    expect(r.refNsr).toBeNull();
    expect(r.refId).toBeUndefined();
  });

  it("registro sem hash não ganha hash vazio (não emite comprovante)", () => {
    const r = paraPontoRegistro(linha({ hash: null }), "pref-1");
    expect(r).not.toHaveProperty("hash");
  });
});

describe("janelasDeMeses", () => {
  it("uma janela por mês, do corrente para trás, sem buraco entre elas", () => {
    const janelas = janelasDeMeses(new Date(2026, 9, 1, 15), 3);
    expect(janelas).toHaveLength(3);
    expect(janelas[0].de).toBe(new Date(2026, 9, 1).toISOString());
    expect(janelas[0].ate).toBe(new Date(2026, 10, 1).toISOString());
    // O fim de um mês é o começo do seguinte.
    expect(janelas[1].ate).toBe(janelas[0].de);
    expect(janelas[2].ate).toBe(janelas[1].de);
    expect(janelas[2].de).toBe(new Date(2026, 7, 1).toISOString());
  });

  it("atravessa a virada do ano", () => {
    const janelas = janelasDeMeses(new Date(2027, 0, 10), 2);
    expect(janelas[1].de).toBe(new Date(2026, 11, 1).toISOString());
  });

  it("mesMaisAntigo é o primeiro mês que as janelas cobrem", () => {
    expect(mesMaisAntigo(new Date(2026, 9, 1), 6)).toBe("2026-05");
    expect(mesMaisAntigo(new Date(2027, 1, 1), 6)).toBe("2026-09");
  });
});

describe("pontoApi.listar", () => {
  beforeEach(() => get.mockReset());

  it("lê pela rota que existe (/ponto/registros), nunca pela /time-records", async () => {
    get.mockResolvedValue({ data: [] });
    await pontoApi.listar("pref-1", new Date(2026, 9, 1));

    expect(get).toHaveBeenCalledTimes(MESES_DE_HISTORICO);
    for (const [path] of get.mock.calls as [string][]) {
      expect(path.startsWith("/ponto/registros?de=")).toBe(true);
      expect(path).toContain("&ate=");
      expect(path).not.toContain("time-records");
      // A identidade vem do token: a rota não aceita CPF nem empresa.
      expect(path).not.toContain("pref-1");
      expect(path).not.toContain("cpf");
    }
  });

  it("junta os meses em ordem de horário e sem repetir batida", async () => {
    get
      .mockResolvedValueOnce({
        data: [
          linha({ id: "b", timestampOriginal: "2026-10-01T10:00:00.000Z" }),
          linha({ id: "a", timestampOriginal: "2026-09-30T20:00:00.000Z" }),
        ],
      })
      .mockResolvedValueOnce({
        data: [linha({ id: "a", timestampOriginal: "2026-09-30T20:00:00.000Z" })],
      })
      .mockResolvedValue({ data: null });

    const lista = await pontoApi.listar("pref-1", new Date(2026, 9, 1));
    expect(lista.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("um mês que falha derruba a leitura inteira: o cache antigo é que fica", async () => {
    get
      .mockResolvedValueOnce({ data: [linha()] })
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValue({ data: [] });
    await expect(pontoApi.listar("pref-1", new Date(2026, 9, 1))).rejects.toThrow("rede");
  });
});

describe("pontoApi.editarHorario", () => {
  beforeEach(async () => {
    post.mockReset();
    await db.outbox.clear();
    sessao.user = JOAO;
    vi.stubGlobal("navigator", { onLine: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("vira solicitação de correção para o RH — a rota de editar não existe mais", async () => {
    post.mockResolvedValueOnce({ data: { id: "s1" } });

    const r = await pontoApi.editarHorario("pk-1", "2026-09-28T10:20:00.000Z", "  relógio  ");

    expect(r).toEqual({ synced: true });
    const [path, corpo, opts] = post.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { idempotencyKey?: string },
    ];
    expect(path).toBe("/solicitacoes-ponto");
    expect(corpo).toEqual({
      tipo: "corrigir",
      prefeituraId: "pref-1",
      name: "João Comboísta",
      cpf: "12345678901",
      batidaId: "pk-1",
      timestampOriginal: "2026-09-28T10:20:00.000Z",
      observacao: "relógio",
    });
    expect(typeof opts.idempotencyKey).toBe("string");
  });

  it("sem sinal, o pedido fica na fila e sobe sozinho depois", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    const r = await pontoApi.editarHorario("pk-1", "2026-09-28T10:20:00.000Z");

    expect(r).toEqual({ synced: false });
    expect(post).not.toHaveBeenCalled();
    const [item] = await db.outbox.toArray();
    expect(item.kind).toBe("solicitacao");
    expect(item.path).toBe("/solicitacoes-ponto");
    expect(item.payload).not.toHaveProperty("observacao");
  });

  it("sem sessão recusa, em vez de mandar um pedido sem dono", async () => {
    sessao.user = null;
    await expect(
      pontoApi.editarHorario("pk-1", "2026-09-28T10:20:00.000Z"),
    ).rejects.toThrow(/sessão/i);
    expect(post).not.toHaveBeenCalled();
  });
});
