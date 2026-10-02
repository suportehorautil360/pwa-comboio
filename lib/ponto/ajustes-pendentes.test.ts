import { describe, expect, it } from "vitest";

import type { OutboxItem } from "../db";
import {
  aplicarCorrecoesPendentes,
  correcoesNaFila,
  type PedidoDeCorrecao,
} from "./ajustes-pendentes";
import type { BatidaEfetiva } from "./resolver-ledger";

function batida(partial: Partial<BatidaEfetiva> = {}): BatidaEfetiva {
  return {
    id: "pk-1",
    legacyId: "aparelho-1",
    name: "João",
    prefeituraId: "p1",
    timestampOriginal: "2026-09-28T10:00:00.000Z",
    tipo: "entrada",
    nsr: 7,
    ...partial,
  };
}

function pedido(partial: Partial<PedidoDeCorrecao> = {}): PedidoDeCorrecao {
  return {
    id: "s1",
    tipo: "corrigir",
    status: "pendente",
    batidaId: "pk-1",
    timestampOriginal: "2026-09-28T10:20:00.000Z",
    observacao: "relógio adiantado",
    createdAt: "2026-09-28T12:00:00.000Z",
    ...partial,
  };
}

describe("aplicarCorrecoesPendentes", () => {
  it("marca a batida com pedido em aberto e mostra o horário pedido", () => {
    const [b] = aplicarCorrecoesPendentes([batida()], [pedido()]);

    expect(b.ajustePendente).toBe(true);
    expect(b.ajustePendenteId).toBe("s1");
    expect(b.horarioAjustePendente).toBe("2026-09-28T10:20:00.000Z");
    expect(b.motivoAjustePendente).toBe("relógio adiantado");
    // Até o RH aprovar, vale o horário batido.
    expect(b.timestampOriginal).toBe("2026-09-28T10:00:00.000Z");
  });

  it("casa pelo id do aparelho também (o back aceita os dois)", () => {
    const [b] = aplicarCorrecoesPendentes(
      [batida()],
      [pedido({ batidaId: "aparelho-1" })],
    );
    expect(b.ajustePendente).toBe(true);
  });

  it("pedido aprovado ou reprovado não deixa a batida pendente", () => {
    for (const status of ["aprovado", "reprovado"] as const) {
      const [b] = aplicarCorrecoesPendentes([batida()], [pedido({ status })]);
      expect(b.ajustePendente).toBeUndefined();
    }
  });

  it("solicitação de outro tipo não marca a batida, mesmo apontando para ela", () => {
    const [b] = aplicarCorrecoesPendentes(
      [batida()],
      [pedido({ tipo: "cancelar" })],
    );
    expect(b.ajustePendente).toBeUndefined();
  });

  it("pedido de outra batida não marca esta", () => {
    const [b] = aplicarCorrecoesPendentes(
      [batida()],
      [pedido({ batidaId: "pk-2" })],
    );
    expect(b.ajustePendente).toBeUndefined();
  });

  it("batida pendente de envio (sem legacyId) não casa com pedido sem alvo", () => {
    const [b] = aplicarCorrecoesPendentes(
      [batida({ legacyId: undefined })],
      [pedido({ batidaId: null })],
    );
    expect(b.ajustePendente).toBeUndefined();
  });

  it("com dois pedidos em aberto, vale o mais novo", () => {
    const [b] = aplicarCorrecoesPendentes(
      [batida()],
      [
        pedido({ id: "novo", createdAt: "2026-09-28T13:00:00.000Z", timestampOriginal: "2026-09-28T10:30:00.000Z" }),
        pedido({ id: "velho", createdAt: "2026-09-28T12:00:00.000Z" }),
      ],
    );
    expect(b.ajustePendenteId).toBe("novo");
    expect(b.horarioAjustePendente).toBe("2026-09-28T10:30:00.000Z");
  });

  it("sem pedidos, devolve a mesma lista", () => {
    const lista = [batida()];
    expect(aplicarCorrecoesPendentes(lista, [])).toBe(lista);
  });
});

describe("correcoesNaFila", () => {
  function item(partial: Partial<OutboxItem>): OutboxItem {
    return {
      id: "i1",
      kind: "solicitacao",
      path: "/solicitacoes-ponto",
      method: "POST",
      payload: {
        tipo: "corrigir",
        batidaId: "pk-1",
        timestampOriginal: "2026-09-28T10:20:00.000Z",
        observacao: "sem sinal",
      },
      createdAt: Date.parse("2026-09-28T12:00:00.000Z"),
      attempts: 0,
      nextAttemptAt: 0,
      ...partial,
    };
  }

  it("o pedido que ainda não saiu do aparelho já marca a batida", () => {
    const pedidos = correcoesNaFila([item({})]);
    expect(pedidos).toEqual([
      {
        id: "i1",
        tipo: "corrigir",
        status: "pendente",
        batidaId: "pk-1",
        timestampOriginal: "2026-09-28T10:20:00.000Z",
        observacao: "sem sinal",
        createdAt: "2026-09-28T12:00:00.000Z",
      },
    ]);
    const [b] = aplicarCorrecoesPendentes([batida()], pedidos);
    expect(b.ajustePendente).toBe(true);
  });

  it("ignora o que não é correção, o que deu erro e os outros kinds", () => {
    expect(
      correcoesNaFila([
        item({ id: "a", payload: { tipo: "abono", data: "2026-09-28" } }),
        item({ id: "b", failed: true }),
        item({ id: "c", kind: "ponto" }),
      ]),
    ).toEqual([]);
  });
});
