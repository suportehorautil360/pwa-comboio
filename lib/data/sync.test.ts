import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { cacheGet } from "./cache";
import { cacheKeys } from "./cache-keys";
import { revalidarFrota, shouldSync } from "./sync";
import type { SessionUser } from "../session";

const comboiosFresco = [
  { id: "c1", tank: { currentVolume: 152000, capacity: 200000 } },
];
const ultimosFresco = [{ id: "l1" }];

vi.mock("../api/comboios", () => ({
  listarComboiosDoMotorista: vi.fn(async () => comboiosFresco),
}));
vi.mock("../api/dashboard", () => ({
  getUltimosLancamentos: vi.fn(async () => ultimosFresco),
  getHistorico: vi.fn(async () => []),
}));

describe("cacheKeys (contrato compartilhado hooks ↔ orquestrador)", () => {
  it("monta as chaves no mesmo formato das queries", () => {
    expect(cacheKeys.comboios("p1", "f1")).toBe("comboios:p1:f1");
    expect(cacheKeys.equipamentos("p1")).toBe("equipamentos:p1");
    expect(cacheKeys.ultimos("p1")).toBe("ultimos:p1:6");
    expect(cacheKeys.timeRecords("p1")).toBe("time-records:p1");
    expect(cacheKeys.solicitacoes("p1")).toBe("solicitacoes:p1");
  });

  it("devolve null quando faltam parâmetros (não busca)", () => {
    expect(cacheKeys.comboios("p1", undefined)).toBeNull();
    expect(cacheKeys.equipamentos(undefined)).toBeNull();
  });
});

describe("shouldSync (revalidar este recurso agora?)", () => {
  const now = Date.now();
  it("offline nunca revalida", () => {
    expect(shouldSync(undefined, 1000, true, false)).toBe(false);
  });
  it("force revalida mesmo fresco", () => {
    expect(shouldSync(now, 60_000, true, true)).toBe(true);
  });
  it("sem force: revalida só quando vencido (ou sem cache)", () => {
    expect(shouldSync(now, 60_000, false, true)).toBe(false); // fresco
    expect(shouldSync(now - 120_000, 60_000, false, true)).toBe(true); // vencido
    expect(shouldSync(undefined, 60_000, false, true)).toBe(true); // sem cache
  });
});

describe("revalidarFrota (atualiza o saldo após um lançamento)", () => {
  const user = {
    prefeituraId: "p1",
    funcionarioId: "f1",
  } as SessionUser;

  beforeEach(() => {
    vi.clearAllMocks();
    // env "node": existe `navigator` mas sem `onLine`. No browser real é boolean.
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("regrava o cache de comboios e de últimos, ignorando o TTL", async () => {
    // Cache 'fresco' com o saldo VELHO — sem o fix, o syncAll pularia por TTL.
    await cacheGet(cacheKeys.comboios("p1", "f1")!); // garante a tabela criada
    await revalidarFrota(user);

    expect(await cacheGet(cacheKeys.comboios("p1", "f1")!)).toEqual(
      comboiosFresco,
    );
    expect(await cacheGet(cacheKeys.ultimos("p1")!)).toEqual(ultimosFresco);
  });

  it("no-op sem usuário (não busca nada)", async () => {
    const { listarComboiosDoMotorista } = await import("../api/comboios");
    await revalidarFrota(null);
    expect(listarComboiosDoMotorista).not.toHaveBeenCalled();
  });
});
