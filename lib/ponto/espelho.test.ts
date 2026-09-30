import { describe, it, expect } from "vitest";
import {
  abonosDoMes,
  abonosNoPeriodo,
  construirEspelho,
  dataBr,
  diasDoMes,
  diasNoIntervalo,
  diasNoPeriodo,
  intervaloPreset,
  totaisDosDias,
} from "./espelho";
import type { Abono } from "../api/abonos";
import type { Escala } from "../api/escala";
import type { PontoRegistro, TipoPonto } from "../api/ponto";

function bat(tipo: TipoPonto, iso: string): PontoRegistro {
  return { id: `${tipo}-${iso}`, name: "Op", prefeituraId: "p1", tipo, timestampOriginal: iso };
}

describe("intervaloPreset", () => {
  const hoje = new Date(2026, 5, 10); // 10/06/2026 (quarta)

  it("hoje → mesmo dia nas duas pontas", () => {
    expect(intervaloPreset("hoje", hoje)).toEqual({
      de: "2026-06-10",
      ate: "2026-06-10",
    });
  });

  it("mes → primeiro ao último dia do mês", () => {
    expect(intervaloPreset("mes", hoje)).toEqual({
      de: "2026-06-01",
      ate: "2026-06-30",
    });
  });

  it("mes-anterior → mês cheio anterior", () => {
    expect(intervaloPreset("mes-anterior", hoje)).toEqual({
      de: "2026-05-01",
      ate: "2026-05-31",
    });
  });
});

describe("diasNoIntervalo", () => {
  it("conta dias inclusivos", () => {
    expect(diasNoIntervalo("2026-06-01", "2026-06-10")).toBe(10);
    expect(diasNoIntervalo("2026-06-10", "2026-06-10")).toBe(1);
  });

  it("retorna 0 quando inválido", () => {
    expect(diasNoIntervalo("2026-06-10", "2026-06-01")).toBe(0);
    expect(diasNoIntervalo("", "2026-06-10")).toBe(0);
  });
});

describe("dataBr", () => {
  it("converte ISO curto para DD/MM/YYYY", () => {
    expect(dataBr("2026-06-10")).toBe("10/06/2026");
  });
});

describe("abonosNoPeriodo", () => {
  const abonos: Abono[] = [
    { id: "1", prefeituraId: "p1", funcionarioCpf: "12345678901", funcionarioNome: "Op", data: "2026-06-05", motivo: "atestado" },
    { id: "2", prefeituraId: "p1", funcionarioCpf: "99999999999", funcionarioNome: "Outro", data: "2026-06-06" },
    { id: "3", prefeituraId: "p1", funcionarioCpf: "123.456.789-01", funcionarioNome: "Op", data: "2026-07-01" },
  ];

  it("filtra por CPF e período", () => {
    const m = abonosNoPeriodo(abonos, "12345678901", "2026-06-01", "2026-06-30");
    expect([...m.keys()]).toEqual(["2026-06-05"]);
    expect(m.get("2026-06-05")).toBe("atestado");
  });

  it("vazio quando sem cpf", () => {
    expect(abonosNoPeriodo(abonos, undefined, "2026-06-01", "2026-06-30").size).toBe(0);
  });
});

describe("diasNoPeriodo + construirEspelho", () => {
  const escala: Escala = {
    prefeituraId: "p1",
    inicio: "08:00",
    fim: "17:00",
    diasSemana: [1, 2, 3, 4, 5],
    almocoMinutos: 60,
  };

  it("pré-popula faltas até 'hoje' e calcula totais", () => {
    const batidas = [
      bat("entrada", new Date(2026, 5, 10, 8).toISOString()),
      bat("saida", new Date(2026, 5, 10, 17).toISOString()),
    ];
    const dias = diasNoPeriodo(batidas, new Map(), "2026-06-10", "2026-06-10", "2026-06-10");
    expect(dias).toHaveLength(1);

    const { linhas, totais } = construirEspelho(dias, new Map(), escala);
    expect(linhas).toHaveLength(1);
    // Trabalhado 08:00, Previsto 08:00, Saldo +00:00.
    expect(totais[totais.length - 1]).toBe("+00:00");
  });
});

describe("saldo do mês (espelho e Meu ponto)", () => {
  // Seg a sex, 08:00–17:00 com 1h de almoço → 8h/dia útil.
  const escala: Escala = {
    prefeituraId: "p1",
    inicio: "08:00",
    fim: "17:00",
    diasSemana: [1, 2, 3, 4, 5],
    almocoMinutos: 60,
  };
  const abono = (data: string): Abono => ({
    id: data,
    prefeituraId: "p1",
    funcionarioCpf: "12345678900",
    funcionarioNome: "Op",
    data,
  });

  it("abonosDoMes filtra por CPF e pelo mês", () => {
    const m = abonosDoMes(
      [abono("2026-06-02"), abono("2026-07-01"), { ...abono("2026-06-03"), funcionarioCpf: "999" }],
      "123.456.789-00",
      "2026-06",
    );
    expect([...m.keys()]).toEqual(["2026-06-02"]);
  });

  it("diasDoMes vai do dia 1 até hoje no mês corrente, mais recente primeiro", () => {
    const dias = diasDoMes(
      [bat("entrada", new Date(2026, 5, 2, 8).toISOString())],
      new Map(),
      "2026-06",
      new Date(2026, 5, 3, 10),
    );
    expect(dias.map(([d]) => d)).toEqual(["2026-06-03", "2026-06-02", "2026-06-01"]);
    expect(dias[1][1]).toHaveLength(1);
  });

  it("diasDoMes não lista dias de mês futuro", () => {
    expect(diasDoMes([], new Map(), "2026-07", new Date(2026, 5, 3))).toEqual([]);
  });

  it("totaisDosDias soma trabalhado/previsto e conta o dia abonado como previsto", () => {
    const d = (h: number, m = 0) => new Date(2026, 5, 2, h, m).toISOString();
    const dias: [string, PontoRegistro[]][] = [
      // terça 02/06: 8h00–12h00 + 13h00–17h30 = 8h30
      ["2026-06-02", [bat("entrada", d(8)), bat("almoco", d(12)), bat("volta", d(13)), bat("saida", d(17, 30))]],
      // quarta 03/06 sem batida, abonada
      ["2026-06-03", []],
      // quinta 04/06 sem batida → falta
      ["2026-06-04", []],
    ];
    const t = totaisDosDias(dias, new Map([["2026-06-03", null]]), escala);
    expect(t).toEqual({ trab: 510 + 480, prev: 480 * 3, saldo: 510 + 480 - 1440 });
  });
});
