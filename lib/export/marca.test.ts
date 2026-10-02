/**
 * Espelho de ponto e comprovante (CRPT) saem com a marca Gestiva 360 no topo,
 * e o REP-P tem o mesmo nome — igual ao painel e ao app do mecânico.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { montarCRPT } from "../ponto/crpt";
import { baixarPDFRecibo } from "./pdf-recibo";
import { baixarPDFTabela } from "./pdf-tabela";

/** Textos desenhados no PDF; o download fica de fora. */
const textos = vi.hoisted(() => [] as string[]);

vi.mock("jspdf", async (importOriginal) => {
  const real = await importOriginal<typeof import("jspdf")>();
  class JsPDFDeTeste extends real.jsPDF {
    constructor(...args: ConstructorParameters<typeof real.jsPDF>) {
      super(...args);
      const desenhar = this.text.bind(this);
      this.text = ((...a: Parameters<typeof desenhar>) => {
        textos.push(...(Array.isArray(a[0]) ? a[0] : [a[0]]));
        return desenhar(...a);
      }) as typeof this.text;
      this.save = (() => this) as unknown as typeof this.save;
    }
  }
  return { ...real, jsPDF: JsPDFDeTeste };
});

beforeEach(() => {
  textos.length = 0;
});

describe("marca dos documentos de ponto", () => {
  it("o espelho de ponto abre com Gestiva 360", async () => {
    await baixarPDFTabela("espelho", {
      titulo: "Espelho de ponto",
      colunas: ["Dia", "Entrada"],
      linhas: [["01/10/2026", "07:00"]],
    });
    expect(textos[0]).toBe("Gestiva 360");
    expect(textos.join(" ")).not.toMatch(/hora útil/i);
  });

  it("o comprovante abre com Gestiva 360 e o REP-P leva o mesmo nome", async () => {
    const crpt = montarCRPT({
      id: "1",
      name: "José",
      prefeituraId: "p1",
      timestampOriginal: "2026-10-01T10:00:00.000Z",
      tipo: "entrada",
      nsr: 7,
      hash: "a".repeat(64),
    });
    expect(crpt.repP).toBe("Gestiva 360 (REP-P v1.0)");
    await baixarPDFRecibo("crpt", {
      titulo: "Comprovante",
      secoes: [{ itens: [{ rotulo: "REP-P", valor: crpt.repP }] }],
    });
    expect(textos[0]).toBe("Gestiva 360");
    expect(textos.join(" ")).not.toMatch(/hora útil/i);
  });
});
