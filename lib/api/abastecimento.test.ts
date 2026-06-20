import { describe, expect, it } from "vitest";

import { ehComboioTipo, tetoAbastecimento } from "./abastecimento";

describe("ehComboioTipo", () => {
  it("reconhece comboio ignorando caixa/espaços", () => {
    expect(ehComboioTipo("Comboio")).toBe(true);
    expect(ehComboioTipo("  comboio ")).toBe(true);
    expect(ehComboioTipo("Caminhões")).toBe(false);
    expect(ehComboioTipo(undefined)).toBe(false);
  });
});

describe("tetoAbastecimento", () => {
  it("comboio usa capacidadeTanqueCaminhao (não o reservatório)", () => {
    expect(
      tetoAbastecimento({
        tipo: "Comboio",
        capacidadeTanque: 5000,
        capacidadeTanqueCaminhao: 400,
      }),
    ).toBe(400);
  });

  it("equipamento comum usa capacidadeTanque", () => {
    expect(tetoAbastecimento({ tipo: "Caminhões", capacidadeTanque: 300 })).toBe(300);
  });

  it("0/ausente = sem limite (0)", () => {
    expect(tetoAbastecimento({ tipo: "Comboio", capacidadeTanqueCaminhao: 0 })).toBe(0);
    expect(tetoAbastecimento({ tipo: "Comboio" })).toBe(0);
    expect(tetoAbastecimento({ tipo: "Caminhões" })).toBe(0);
  });
});
