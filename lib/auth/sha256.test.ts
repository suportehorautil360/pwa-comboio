import { describe, expect, it } from "vitest";

import { hashSenhaFuncionario, sha256hex } from "./sha256";

describe("sha256hex", () => {
  it("bate com o vetor conhecido (paridade com o SHA-256 do back)", async () => {
    // SHA-256("abc") — vetor padrão. Garante hex minúsculo igual ao
    // createHash('sha256').digest('hex') do NestJS.
    expect(await sha256hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("hashSenhaFuncionario", () => {
  it("salga com o CPF (só dígitos), igual ao back: SHA-256('<cpf>:<senha>')", async () => {
    const comFormatacao = await hashSenhaFuncionario("123.456.789-00", "x");
    const semFormatacao = await sha256hex("12345678900:x");
    expect(comFormatacao).toBe(semFormatacao);
  });

  it("senhas diferentes → hashes diferentes", async () => {
    const a = await hashSenhaFuncionario("12345678900", "senha1");
    const b = await hashSenhaFuncionario("12345678900", "senha2");
    expect(a).not.toBe(b);
  });
});
