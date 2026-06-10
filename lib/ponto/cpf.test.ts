import { describe, it, expect } from "vitest";
import { formatarCpf, limparCpf } from "./cpf";

describe("limparCpf", () => {
  it("remove tudo que não é dígito", () => {
    expect(limparCpf("123.456.789-01")).toBe("12345678901");
    expect(limparCpf("")).toBe("");
  });
});

describe("formatarCpf", () => {
  it("formata 11 dígitos no padrão CPF", () => {
    expect(formatarCpf("12345678901")).toBe("123.456.789-01");
  });

  it("aceita entrada já com máscara", () => {
    expect(formatarCpf("123.456.789-01")).toBe("123.456.789-01");
  });
});
