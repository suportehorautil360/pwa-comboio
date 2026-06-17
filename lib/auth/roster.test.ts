import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashSenhaFuncionario } from "./sha256";
import { limparRoster, loginPelaRoster, salvarRoster } from "./roster";

function memStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

async function cred(cpf: string, login: string, senha: string) {
  return {
    id: `f-${cpf}`,
    cpf,
    loginGerado: login,
    nome: "Fulano",
    cargo: "comboista",
    prefeituraId: "pref-1",
    senhaHash: await hashSenhaFuncionario(cpf, senha),
  };
}

describe("loginPelaRoster", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", memStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loga qualquer condutor da roster por CPF + senha correta", async () => {
    salvarRoster("pref-1", [
      await cred("12345678900", "joao900", "senha-joao"),
      await cred("98765432100", "maria100", "senha-maria"),
    ]);
    const r = await loginPelaRoster("98765432100", "senha-maria");
    expect(r).not.toBeNull();
    expect(r?.user).toMatchObject({
      funcionarioId: "f-98765432100",
      prefeituraId: "pref-1",
      usuario: "maria100",
    });
  });

  it("loga por login gerado", async () => {
    salvarRoster("pref-1", [await cred("12345678900", "joao900", "senha-joao")]);
    const r = await loginPelaRoster("joao900", "senha-joao");
    expect(r?.user.funcionarioId).toBe("f-12345678900");
  });

  it("senha errada → null", async () => {
    salvarRoster("pref-1", [await cred("12345678900", "joao900", "senha-joao")]);
    expect(await loginPelaRoster("12345678900", "errada")).toBeNull();
  });

  it("identificador fora da roster → null", async () => {
    salvarRoster("pref-1", [await cred("12345678900", "joao900", "x")]);
    expect(await loginPelaRoster("00000000000", "x")).toBeNull();
  });

  it("roster vencida → null e é removida", async () => {
    salvarRoster("pref-1", [await cred("12345678900", "joao900", "x")]);
    const raw = JSON.parse(localStorage.getItem("hu360_roster")!);
    raw.validoAte = Date.now() - 1;
    localStorage.setItem("hu360_roster", JSON.stringify(raw));
    expect(await loginPelaRoster("12345678900", "x")).toBeNull();
    expect(localStorage.getItem("hu360_roster")).toBeNull();
  });

  it("limparRoster zera o cache", async () => {
    salvarRoster("pref-1", [await cred("12345678900", "joao900", "x")]);
    limparRoster();
    expect(await loginPelaRoster("12345678900", "x")).toBeNull();
  });
});
