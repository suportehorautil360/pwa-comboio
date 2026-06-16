import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  limparCredencialOffline,
  loginOffline,
  salvarCredencialOffline,
} from "./offline-credential";
import type { SessionUser } from "../session";

const USER: SessionUser = {
  nome: "João",
  usuario: "joao123",
  perfil: "comboista",
  vinculo: "operador",
  prefeituraId: "pref-1",
  cpf: "12345678900",
  funcionarioId: "f-1",
};

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

describe("offline-credential (PBKDF2)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", memStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("salva e valida a senha correta → devolve token + user", async () => {
    await salvarCredencialOffline("joao123", "senha-certa", "tok-1", USER);
    const r = await loginOffline("joao123", "senha-certa");
    expect(r).not.toBeNull();
    expect(r?.token).toBe("tok-1");
    expect(r?.user).toMatchObject({ funcionarioId: "f-1" });
  });

  it("senha errada → null", async () => {
    await salvarCredencialOffline("joao123", "senha-certa", "tok-1", USER);
    expect(await loginOffline("joao123", "senha-errada")).toBeNull();
  });

  it("identificador diferente → null", async () => {
    await salvarCredencialOffline("joao123", "senha-certa", "tok-1", USER);
    expect(await loginOffline("outro", "senha-certa")).toBeNull();
  });

  it("sem credencial salva → null", async () => {
    expect(await loginOffline("joao123", "qualquer")).toBeNull();
  });

  it("credencial vencida (passou a validade) → null e é removida", async () => {
    await salvarCredencialOffline("joao123", "senha-certa", "tok-1", USER);
    // força o vencimento mexendo no validoAte gravado
    const raw = JSON.parse(localStorage.getItem("hu360_offline_cred")!);
    raw.validoAte = Date.now() - 1;
    localStorage.setItem("hu360_offline_cred", JSON.stringify(raw));

    expect(await loginOffline("joao123", "senha-certa")).toBeNull();
    expect(localStorage.getItem("hu360_offline_cred")).toBeNull();
  });

  it("limparCredencialOffline remove a credencial", async () => {
    await salvarCredencialOffline("joao123", "senha-certa", "tok-1", USER);
    limparCredencialOffline();
    expect(await loginOffline("joao123", "senha-certa")).toBeNull();
  });
});
