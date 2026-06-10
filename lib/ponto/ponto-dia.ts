/**
 * Controle de "bateu o ponto de entrada hoje?" por dia + pessoa, no
 * localStorage do dispositivo. Usado pelo gate obrigatório (uma vez por dia).
 * A identidade usa funcionarioId/cpf (ponto é por pessoa); cai no login gerado
 * para sessões sem esses campos.
 */
import type { SessionUser } from "../session";

type SessaoPonto = Pick<SessionUser, "funcionarioId" | "cpf" | "usuario">;

function hojeStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function identidade(s: SessaoPonto): string {
  return s.funcionarioId || s.cpf || s.usuario || "anon";
}

function chave(s: SessaoPonto): string {
  return `hu360-ponto:${hojeStr()}:${identidade(s)}`;
}

export function jaBateuHoje(s: SessaoPonto): boolean {
  try {
    return localStorage.getItem(chave(s)) === "1";
  } catch {
    return false;
  }
}

export function marcarBatidaHoje(s: SessaoPonto): void {
  try {
    localStorage.setItem(chave(s), "1");
  } catch {
    /* ignore */
  }
}
