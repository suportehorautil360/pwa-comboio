import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import type { OutboxItem } from "../db";
import {
  batidasPendentes,
  mesclarBatidas,
  saldoPendenteDelta,
} from "./pendentes";

function item(partial: Partial<OutboxItem>): OutboxItem {
  return {
    id: "i1",
    kind: "abastecimento",
    path: "/x",
    method: "POST",
    payload: {},
    createdAt: 0,
    attempts: 0,
    nextAttemptAt: 0,
    ...partial,
  };
}

describe("batidasPendentes", () => {
  it("converte itens de ponto da fila em batidas sintéticas (id do item)", () => {
    const itens = [
      item({
        id: "p1",
        kind: "ponto",
        payload: {
          name: "João",
          prefeituraId: "pref",
          timestampOriginal: "2026-06-16T08:00:00.000Z",
          tipo: "entrada",
          cpf: "123",
        },
      }),
      item({ id: "a1", kind: "abastecimento", payload: { liters: 10 } }),
    ];
    const r = batidasPendentes(itens);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      id: "p1",
      tipo: "entrada",
      name: "João",
      status: "pendente",
    });
  });

  it("ignora batidas em erro (dead-letter)", () => {
    expect(
      batidasPendentes([item({ kind: "ponto", failed: true, payload: { tipo: "saida" } })]),
    ).toHaveLength(0);
  });
});

describe("mesclarBatidas", () => {
  const pend = batidasPendentes([
    item({
      id: "p1",
      kind: "ponto",
      payload: { tipo: "entrada", timestampOriginal: "2026-06-16T08:00:00Z" },
    }),
  ]);

  it("inclui a pendente quando o servidor não tem aquele tipo no dia", () => {
    const r = mesclarBatidas([], pend);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("p1");
  });

  it("não duplica quando o servidor já tem o mesmo tipo no mesmo dia", () => {
    const servidor = [
      {
        id: "srv",
        name: "x",
        prefeituraId: "p",
        tipo: "entrada" as const,
        timestampOriginal: "2026-06-16T08:05:00Z",
      },
    ];
    const r = mesclarBatidas(servidor, pend);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("srv");
  });
});

describe("saldoPendenteDelta", () => {
  it("soma reabastecimento e subtrai abastecimento do tanque (sem posto)", () => {
    const itens = [
      item({ kind: "reabastecimento", payload: { receivedLiters: 200 } }),
      item({ kind: "abastecimento", payload: { liters: 50 } }),
    ];
    expect(saldoPendenteDelta(itens)).toBe(150);
  });

  it("ignora abastecimento de posto (não sai do tanque do comboio)", () => {
    const itens = [
      item({ kind: "abastecimento", payload: { liters: 50, postoId: "posto-1" } }),
    ];
    expect(saldoPendenteDelta(itens)).toBe(0);
  });

  it("ignora itens em erro", () => {
    expect(
      saldoPendenteDelta([
        item({ kind: "reabastecimento", failed: true, payload: { receivedLiters: 99 } }),
      ]),
    ).toBe(0);
  });
});
