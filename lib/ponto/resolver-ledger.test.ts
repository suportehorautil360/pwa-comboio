import { describe, it, expect } from "vitest";
import { resolverLedger } from "./resolver-ledger";
import type { PontoRegistro } from "../api/ponto";

function orig(over: Partial<PontoRegistro> = {}): PontoRegistro {
  return {
    id: "o1",
    name: "Op",
    prefeituraId: "p1",
    tipo: "entrada",
    timestampOriginal: "2026-06-10T11:00:00.000Z",
    nsr: 1,
    registro: "original",
    ...over,
  };
}

describe("resolverLedger", () => {
  it("mantém a batida original quando não há ajuste", () => {
    const r = resolverLedger([orig()]);
    expect(r).toHaveLength(1);
    expect(r[0].timestampOriginal).toBe("2026-06-10T11:00:00.000Z");
    expect(r[0].ajustePendente).toBeUndefined();
  });

  it("aplica correção APROVADA (troca o horário oficial)", () => {
    const correcao: PontoRegistro = {
      id: "a1",
      name: "Op",
      prefeituraId: "p1",
      tipo: "entrada",
      timestampOriginal: "2026-06-10T12:00:00.000Z",
      registro: "ajuste",
      refNsr: 1,
      aplicado: true,
    };
    const r = resolverLedger([orig(), correcao]);
    expect(r).toHaveLength(1);
    expect(r[0].timestampOriginal).toBe("2026-06-10T12:00:00.000Z");
    expect(r[0].horarioAnterior).toBe("2026-06-10T11:00:00.000Z");
  });

  it("marca correção PENDENTE sem trocar o horário oficial", () => {
    const correcao: PontoRegistro = {
      id: "a1",
      name: "Op",
      prefeituraId: "p1",
      tipo: "entrada",
      timestampOriginal: "2026-06-10T12:00:00.000Z",
      registro: "ajuste",
      refNsr: 1,
    };
    const r = resolverLedger([orig(), correcao]);
    expect(r[0].timestampOriginal).toBe("2026-06-10T11:00:00.000Z");
    expect(r[0].ajustePendente).toBe(true);
    expect(r[0].horarioAjustePendente).toBe("2026-06-10T12:00:00.000Z");
  });

  it("remove a original quando há cancelamento aplicado", () => {
    const cancel: PontoRegistro = {
      id: "c1",
      name: "Op",
      prefeituraId: "p1",
      tipo: "entrada",
      timestampOriginal: "2026-06-10T11:00:00.000Z",
      registro: "cancelamento",
      refNsr: 1,
    };
    expect(resolverLedger([orig(), cancel])).toHaveLength(0);
  });

  it("inclui batida esquecida aprovada (ajuste sem alvo)", () => {
    const inclusao: PontoRegistro = {
      id: "i1",
      name: "Op",
      prefeituraId: "p1",
      tipo: "saida",
      timestampOriginal: "2026-06-10T20:00:00.000Z",
      registro: "ajuste",
      refNsr: null,
      aplicado: true,
    };
    const r = resolverLedger([orig(), inclusao]);
    expect(r).toHaveLength(2);
    expect(r.some((x) => x.tipo === "saida")).toBe(true);
  });

  it("descarta batida legada com status 'cancelado'", () => {
    expect(resolverLedger([orig({ status: "cancelado" })])).toHaveLength(0);
  });
});
