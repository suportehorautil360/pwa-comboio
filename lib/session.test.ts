import { describe, expect, it } from "vitest";

import { parseExpiresMs } from "./session";

const FALLBACK = 999;

describe("parseExpiresMs", () => {
  it("interpreta sufixos d/h/m/s", () => {
    expect(parseExpiresMs("7d", FALLBACK)).toBe(7 * 86_400_000);
    expect(parseExpiresMs("15m", FALLBACK)).toBe(15 * 60_000);
    expect(parseExpiresMs("12h", FALLBACK)).toBe(12 * 3_600_000);
    expect(parseExpiresMs("3600s", FALLBACK)).toBe(3_600_000);
  });

  it("sem sufixo assume segundos (padrão JWT)", () => {
    expect(parseExpiresMs("3600", FALLBACK)).toBe(3_600_000);
  });

  it("número é tratado como segundos", () => {
    expect(parseExpiresMs(3600, FALLBACK)).toBe(3_600_000);
  });

  it("ausente ou inválido cai no fallback", () => {
    expect(parseExpiresMs(undefined, FALLBACK)).toBe(FALLBACK);
    expect(parseExpiresMs("", FALLBACK)).toBe(FALLBACK);
    expect(parseExpiresMs("lixo", FALLBACK)).toBe(FALLBACK);
  });
});
