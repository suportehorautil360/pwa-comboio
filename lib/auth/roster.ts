/**
 * Roster de login offline MULTIUSUÁRIO. No login online (e a cada sync), o app
 * pré-cacheia os verificadores de senha de TODOS os condutores da prefeitura
 * (vindos de GET /funcionarios/credenciais-offline). Offline, qualquer condutor
 * digita usuário+senha → valida local (SHA-256 salgado com CPF, igual ao back)
 * → entra. É o pareamento com o app do operador, sem Firebase.
 *
 * Guarda só o HASH da senha (não a senha), por prefeitura, com validade. O token
 * não é necessário: os endpoints de escrita do back identificam o funcionário
 * pelo payload (cpf/prefeituraId), não pelo JWT.
 */
import { api } from "../api/client";
import { limparCpf } from "../ponto/cpf";
import type { SessionUser } from "../session";
import { hashSenhaFuncionario } from "./sha256";

const KEY = "hu360_roster";
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

export interface RosterCred {
  id: string;
  cpf: string;
  loginGerado: string;
  nome: string;
  cargo: string;
  prefeituraId: string;
  senhaHash: string;
}

interface Roster {
  prefeituraId: string;
  validoAte: number;
  creds: RosterCred[];
}

export interface SessaoRoster {
  user: SessionUser;
  validoAte: number;
}

function lerRoster(): Roster | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Roster) : null;
  } catch {
    return null;
  }
}

/** Grava a roster da prefeitura com validade (ancorada ao provisionamento). */
export function salvarRoster(prefeituraId: string, creds: RosterCred[]): void {
  if (typeof window === "undefined") return;
  try {
    const roster: Roster = {
      prefeituraId,
      validoAte: Date.now() + VALIDADE_MS,
      creds,
    };
    localStorage.setItem(KEY, JSON.stringify(roster));
  } catch {
    /* storage indisponível — ignora */
  }
}

/** Baixa e pré-cacheia os verificadores da prefeitura. Best-effort (offline mantém). */
export async function provisionarRoster(prefeituraId?: string): Promise<void> {
  if (!prefeituraId) return;
  try {
    const r = await api.get<{ data: RosterCred[] }>(
      `/funcionarios/credenciais-offline/${prefeituraId}`,
    );
    salvarRoster(prefeituraId, r.data ?? []);
  } catch {
    /* offline/erro: mantém a roster anterior */
  }
}

export function limparRoster(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}

function acharCred(creds: RosterCred[], identificador: string): RosterCred | undefined {
  const id = identificador.trim();
  const cpf = limparCpf(id);
  const ehCpf = cpf.length === 11;
  return creds.find((c) =>
    ehCpf
      ? limparCpf(c.cpf) === cpf
      : !!c.loginGerado && c.loginGerado.toLowerCase() === id.toLowerCase(),
  );
}

/**
 * Valida usuário+senha contra a roster local (offline). Devolve a sessão a
 * restaurar (sem token — o back não exige) ou null. Remove a roster vencida.
 */
export async function loginPelaRoster(
  identificador: string,
  senha: string,
): Promise<SessaoRoster | null> {
  const roster = lerRoster();
  if (!roster) return null;
  if (Date.now() >= roster.validoAte) {
    limparRoster();
    return null;
  }
  const cred = acharCred(roster.creds, identificador);
  if (!cred || !cred.senhaHash) return null;
  const hash = await hashSenhaFuncionario(cred.cpf, senha);
  if (hash !== cred.senhaHash) return null;

  const user: SessionUser = {
    nome: cred.nome,
    usuario: cred.loginGerado || cred.cpf,
    perfil: cred.cargo,
    vinculo: "operador",
    prefeituraId: cred.prefeituraId,
    cpf: cred.cpf,
    funcionarioId: cred.id,
  };
  return { user, validoAte: roster.validoAte };
}
