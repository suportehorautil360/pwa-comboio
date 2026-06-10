import { describe, it, expect } from "vitest";
import { itemParaLancamento, type OutboxItem } from "./outbox";

function item(kind: OutboxItem["kind"], payload: unknown, failed = false): OutboxItem {
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
