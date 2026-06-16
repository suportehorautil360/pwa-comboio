import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { cacheKeys } from "./cache-keys";
import { shouldSync } from "./sync";

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
