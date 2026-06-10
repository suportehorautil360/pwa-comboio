import { describe, it, expect, beforeEach } from "vitest";
import { jaBateuHoje, marcarBatidaHoje } from "./ponto-dia";

/** localStorage mínimo em memória para o ambiente node. */
function instalarLocalStorage() {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

type Sess = { usuario: string; cpf?: string; funcionarioId?: string };
const sess = (over: Partial<Sess>): Sess => ({ usuario: "", ...over });

describe("ponto-dia", () => {
  beforeEach(() => instalarLocalStorage());

  it("jaBateuHoje é falso antes de marcar", () => {
    expect(jaBateuHoje(sess({ funcionarioId: "f1" }))).toBe(false);
  });

  it("marcarBatidaHoje torna jaBateuHoje verdadeiro (mesma pessoa)", () => {
    const s = sess({ funcionarioId: "f1" });
    marcarBatidaHoje(s);
    expect(jaBateuHoje(s)).toBe(true);
  });

  it("é por pessoa: outra identidade não herda a marca", () => {
    marcarBatidaHoje(sess({ funcionarioId: "f1" }));
    expect(jaBateuHoje(sess({ funcionarioId: "f2" }))).toBe(false);
  });

  it("cai no cpf/usuario quando não há funcionarioId", () => {
    marcarBatidaHoje(sess({ cpf: "123" }));
    expect(jaBateuHoje(sess({ cpf: "123" }))).toBe(true);
  });
});
