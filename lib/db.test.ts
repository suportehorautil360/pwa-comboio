import { describe, expect, it } from "vitest";

import { legacyToEvent, OUTBOX_PATHS } from "./db";

describe("legacyToEvent (migração outbox v1 → v2)", () => {
  it("resolve path/method estáticos a partir do kind e zera o backoff", () => {
    const ev = legacyToEvent({
      id: "a1",
      kind: "abastecimento",
      payload: { liters: 10 },
      createdAt: 123,
      attempts: 0,
    });
    expect(ev).toMatchObject({
      id: "a1",
      kind: "abastecimento",
      path: "/abastecimentos",
      method: "POST",
      payload: { liters: 10 },
      createdAt: 123,
      attempts: 0,
      nextAttemptAt: 0,
    });
  });

  it("preserva idempotencyKey e o estado failed", () => {
    const ev = legacyToEvent({
      id: "p1",
      kind: "ponto",
      payload: { tipo: "entrada" },
      createdAt: 5,
      attempts: 2,
      idempotencyKey: "key-123",
      failed: true,
    });
    expect(ev.path).toBe("/time-records");
    expect(ev.idempotencyKey).toBe("key-123");
    expect(ev.failed).toBe(true);
    expect(ev.attempts).toBe(2);
  });

  it("mapeia todos os kinds estáticos conhecidos para um path", () => {
    for (const kind of [
      "abastecimento",
      "lubrificacao",
      "reabastecimento",
      "ponto",
      "solicitacao",
    ] as const) {
      expect(OUTBOX_PATHS[kind]).toBeTruthy();
    }
    // editar-ponto é dinâmico (path resolvido com o id no enqueue)
    expect(OUTBOX_PATHS["editar-ponto"]).toBeNull();
  });
});
