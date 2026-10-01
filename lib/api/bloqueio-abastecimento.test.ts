import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fase 2 das inspeções: o comboio pergunta ao back se a máquina está
 * bloqueada por item impeditivo reprovado e mostra o motivo antes de salvar.
 */
const get = vi.fn();
vi.mock("./client", () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

import { bloqueioDoAbastecimento } from "./abastecimento";

beforeEach(() => get.mockReset());

describe("bloqueio do abastecimento por inspeção", () => {
  it("bloqueada: devolve título e motivo", async () => {
    get.mockResolvedValue({
      data: { bloqueado: true, titulo: "Máquina bloqueada por inspeção", detalhe: "FREIOS nº 2 — Freio de estacionamento." },
    });
    const b = await bloqueioDoAbastecimento("pref-1", "ABC1D23");
    expect(get).toHaveBeenCalledWith("/abastecimentos/bloqueio/pref-1?plateOrChassis=ABC1D23");
    expect(b).toMatchObject({ titulo: "Máquina bloqueada por inspeção", detalhe: expect.stringContaining("Freio") });
  });

  it("livre: null", async () => {
    get.mockResolvedValue({ data: { bloqueado: false } });
    await expect(bloqueioDoAbastecimento("pref-1", "ABC1D23")).resolves.toBeNull();
  });
});
