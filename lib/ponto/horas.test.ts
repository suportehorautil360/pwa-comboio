import { describe, it, expect } from "vitest";
import { fmtMin, minutosPrevistos, minutosTrabalhados } from "./horas";
import type { Escala } from "../api/escala";
import type { PontoRegistro, TipoPonto } from "../api/ponto";

/** Batida com horário local fixo (independe do fuso, usa componentes locais). */
function b(tipo: TipoPonto, h: number, m = 0): PontoRegistro {
  return {
    id: `${tipo}-${h}`,
    name: "Op",
    prefeituraId: "p1",
    tipo,
    timestampOriginal: new Date(2026, 5, 10, h, m).toISOString(),
  };
}

describe("minutosTrabalhados", () => {
  it("soma manhã + tarde quando há almoço marcado", () => {
    const dia = [b("entrada", 8), b("almoco", 12), b("volta", 13), b("saida", 17)];
    expect(minutosTrabalhados(dia, 60)).toBe(480); // 4h + 4h
  });

  it("usa entrada→saída menos o almoço da escala quando não há marca de almoço", () => {
    expect(minutosTrabalhados([b("entrada", 8), b("saida", 17)], 60)).toBe(480);
  });

  it("retorna 0 quando só tem entrada", () => {
    expect(minutosTrabalhados([b("entrada", 8)], 60)).toBe(0);
  });
});

describe("minutosPrevistos", () => {
  const escala: Escala = {
    prefeituraId: "p1",
    inicio: "08:00",
    fim: "17:00",
    diasSemana: [1, 2, 3, 4, 5],
    almocoMinutos: 60,
  };

  it("calcula a jornada prevista num dia útil", () => {
    // 2026-06-10 é quarta-feira.
    expect(minutosPrevistos(escala, "2026-06-10")).toBe(480);
  });

  it("retorna 0 num dia fora da escala (sábado)", () => {
    // 2026-06-13 é sábado.
    expect(minutosPrevistos(escala, "2026-06-13")).toBe(0);
  });

  it("retorna 0 quando não há escala", () => {
    expect(minutosPrevistos(null, "2026-06-10")).toBe(0);
  });
});

describe("fmtMin", () => {
  it("formata minutos como HH:MM", () => {
    expect(fmtMin(480)).toBe("08:00");
    expect(fmtMin(90)).toBe("01:30");
    expect(fmtMin(0)).toBe("00:00");
  });

  it("usa sinal para negativos", () => {
    expect(fmtMin(-90)).toBe("-01:30");
  });
});
