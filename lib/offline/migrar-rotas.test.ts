import { describe, expect, it } from "vitest";

import type { OutboxItem } from "../db";
import {
  ERRO_BATIDA_REPETIDA,
  migrarFila,
  precisaMigrar,
} from "./migrar-rotas";

const QUEM = { prefeituraId: "pref-1", nome: "João Comboísta", cpf: "12345678901" };

/** Instante ISO ao meio-dia LOCAL do dia — o dia não muda com o fuso de quem roda o teste. */
function aoMeioDia(dia: string, hora = 12): string {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(y, m - 1, d, hora, 0, 0).toISOString();
}

/** Batida presa nos erros de sincronização, como o 404 da rota antiga a deixou. */
function batidaPresa(partial: Partial<OutboxItem> & { id: string }, corpo = {}): OutboxItem {
  return {
    kind: "ponto",
    path: "/time-records",
    method: "POST",
    payload: {
      name: "João Comboísta",
      photo: "data:image/jpeg;base64,AAAA",
      prefeituraId: "pref-1",
      timestampOriginal: aoMeioDia("2026-09-28", 7),
      tipo: "entrada",
      cpf: "12345678901",
      ...corpo,
    },
    createdAt: 1,
    attempts: 1,
    nextAttemptAt: 0,
    idempotencyKey: `chave-${partial.id}`,
    failed: true,
    lastError: "Cannot POST /time-records",
    ...partial,
  };
}

describe("precisaMigrar", () => {
  it("reconhece as duas rotas do ponto antigo", () => {
    expect(precisaMigrar({ path: "/time-records" })).toBe(true);
    expect(precisaMigrar({ path: "/time-records/update/abc" })).toBe(true);
  });

  it("não toca no resto da fila", () => {
    expect(precisaMigrar({ path: "/abastecimentos" })).toBe(false);
    expect(precisaMigrar({ path: "/checklist/bater-ponto" })).toBe(false);
    expect(precisaMigrar({ path: "/solicitacoes-ponto" })).toBe(false);
    expect(precisaMigrar({ path: "/time-records-novo" })).toBe(false);
  });
});

describe("migrarFila — batida presa na rota antiga", () => {
  it("vai para a rota nova e volta a ser elegível, sem refazer nada", () => {
    const [m] = migrarFila([batidaPresa({ id: "b1" })], QUEM);

    expect(m.path).toBe("/checklist/bater-ponto");
    expect(m.method).toBe("POST");
    expect(m.failed).toBe(false);
    expect(m.attempts).toBe(0);
    expect(m.nextAttemptAt).toBe(0);
    expect(m.lastError).toBeUndefined();
  });

  it("o corpo não muda: mesma selfie e o horário em que a pessoa bateu", () => {
    const original = batidaPresa({ id: "b1" });
    const [m] = migrarFila([original], QUEM);
    expect(m.payload).toEqual(original.payload);
  });

  it("mantém a chave de idempotência — reenvio continua não duplicando", () => {
    const [m] = migrarFila([batidaPresa({ id: "b1" })], QUEM);
    expect(m.idempotencyKey).toBe("chave-b1");
  });

  it("item herdado sem chave ganha o próprio id: a rota nova exige Idempotency-Key", () => {
    const [m] = migrarFila(
      [batidaPresa({ id: "b1", idempotencyKey: undefined })],
      QUEM,
    );
    expect(m.idempotencyKey).toBe("b1");
  });

  it("não precisa de sessão: a batida já diz de quem é", () => {
    expect(migrarFila([batidaPresa({ id: "b1" })], null)).toHaveLength(1);
  });

  it("migra também a que ainda estava pendente (não chegou a dar 404)", () => {
    const [m] = migrarFila(
      [batidaPresa({ id: "b1", failed: false, attempts: 0, lastError: undefined })],
      QUEM,
    );
    expect(m.path).toBe("/checklist/bater-ponto");
    expect(m.failed).toBe(false);
  });

  it("dias e tipos diferentes sobem todos", () => {
    const fila = [
      batidaPresa({ id: "a" }),
      batidaPresa({ id: "b" }, { tipo: "saida", timestampOriginal: aoMeioDia("2026-09-28", 17) }),
      batidaPresa({ id: "c" }, { timestampOriginal: aoMeioDia("2026-09-29", 7) }),
    ];
    const mudados = migrarFila(fila, QUEM);
    expect(mudados).toHaveLength(3);
    expect(mudados.every((m) => m.failed === false)).toBe(true);
  });

  it("fila sem item antigo não muda nada", () => {
    const fila: OutboxItem[] = [
      {
        id: "x",
        kind: "abastecimento",
        path: "/abastecimentos",
        method: "POST",
        payload: {},
        createdAt: 0,
        attempts: 0,
        nextAttemptAt: 0,
      },
    ];
    expect(migrarFila(fila, QUEM)).toEqual([]);
  });
});

// Depois do 404 a linha do dia voltava a "Sem registro" e a pessoa podia bater
// de novo. A rota nova não recusa o mesmo tipo no mesmo dia, e batida dupla no
// ledger é registro legal errado, que não se apaga.
describe("migrarFila — batida repetida não sobe duas vezes", () => {
  it("do mesmo tipo no mesmo dia, sobe só a PRIMEIRA", () => {
    const fila = [
      batidaPresa({ id: "segunda" }, { timestampOriginal: aoMeioDia("2026-09-28", 9) }),
      batidaPresa({ id: "primeira" }, { timestampOriginal: aoMeioDia("2026-09-28", 7) }),
    ];
    const mudados = migrarFila(fila, QUEM);
    const porId = Object.fromEntries(mudados.map((m) => [m.id, m]));

    expect(porId.primeira.failed).toBe(false);
    expect(porId.segunda.failed).toBe(true);
    expect(porId.segunda.lastError).toBe(ERRO_BATIDA_REPETIDA);
    // A repetida fica na rota nova: se a pessoa mandar reenviar, vai para o
    // lugar certo — a decisão é dela, e fica à vista nos erros.
    expect(porId.segunda.path).toBe("/checklist/bater-ponto");
  });

  it("respeita a batida do mesmo dia que já está na fila pela rota nova", () => {
    const jaNaFila: OutboxItem = {
      ...batidaPresa({ id: "nova" }),
      path: "/checklist/bater-ponto",
      failed: false,
    };
    const mudados = migrarFila([jaNaFila, batidaPresa({ id: "antiga" })], QUEM);

    expect(mudados).toHaveLength(1);
    expect(mudados[0].id).toBe("antiga");
    expect(mudados[0].failed).toBe(true);
  });

  it("pessoas diferentes no mesmo aparelho não se anulam", () => {
    const fila = [
      batidaPresa({ id: "joao" }),
      batidaPresa({ id: "maria" }, { name: "Maria", cpf: "98765432100" }),
    ];
    const mudados = migrarFila(fila, QUEM);
    expect(mudados.every((m) => m.failed === false)).toBe(true);
  });

  it("sem CPF, a pessoa é o nome", () => {
    const fila = [
      batidaPresa({ id: "a" }, { cpf: undefined, name: "João " }),
      batidaPresa({ id: "b" }, { cpf: undefined, name: "joão", timestampOriginal: aoMeioDia("2026-09-28", 8) }),
    ];
    const mudados = migrarFila(fila, QUEM);
    expect(mudados.filter((m) => m.failed)).toHaveLength(1);
  });
});

describe("migrarFila — correção de horário presa na rota antiga", () => {
  const edicao: OutboxItem = {
    id: "e1",
    kind: "editar-ponto",
    path: "/time-records/update/batida-42",
    method: "POST",
    payload: { timestampOriginal: "2026-09-28T10:30:00.000Z", motivo: " esqueci " },
    createdAt: 5,
    attempts: 1,
    nextAttemptAt: 0,
    idempotencyKey: "chave-e1",
    failed: true,
    lastError: "Cannot POST /time-records/update/batida-42",
  };

  it("vira solicitação de correção para o RH, apontando a mesma batida", () => {
    const [m] = migrarFila([edicao], QUEM);

    expect(m.kind).toBe("solicitacao");
    expect(m.path).toBe("/solicitacoes-ponto");
    expect(m.failed).toBe(false);
    expect(m.idempotencyKey).toBe("chave-e1");
    expect(m.payload).toEqual({
      tipo: "corrigir",
      prefeituraId: "pref-1",
      name: "João Comboísta",
      cpf: "12345678901",
      batidaId: "batida-42",
      timestampOriginal: "2026-09-28T10:30:00.000Z",
      observacao: "esqueci",
    });
  });

  it("sem motivo, não manda observação vazia", () => {
    const [m] = migrarFila(
      [{ ...edicao, payload: { timestampOriginal: "2026-09-28T10:30:00.000Z" } }],
      QUEM,
    );
    expect(m.payload).not.toHaveProperty("observacao");
  });

  // A solicitação tem de dizer de quem é; sem sessão não há como saber.
  it("sem sessão fica como está, para migrar quando alguém entrar", () => {
    expect(migrarFila([edicao], null)).toEqual([]);
  });
});
