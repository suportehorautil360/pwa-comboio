/**
 * Login offline por verificação local (sem servidor). No 1º login ONLINE de um
 * funcionário neste aparelho, guardamos um verificador da senha (PBKDF2 com sal,
 * via Web Crypto) + a sessão (token/usuário) e uma validade. Offline, o operador
 * digita usuário+senha → validamos contra o verificador local e restauramos a
 * sessão. NUNCA guardamos a senha em claro nem a tabela de usuários — só o hash
 * deste aparelho, deste usuário.
 *
 * Limites (de propósito): 1 usuário por aparelho; só quem já logou online aqui;
 * válido por 7 dias (o token guardado precisa ainda valer pra sincronizar
 * depois). Passado isso, exige login online.
 */
import type { SessionUser } from "../session";

const KEY = "hu360_offline_cred";
const ITERACOES = 150_000;
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

interface CredOffline {
  /** Identificador normalizado (CPF/login) usado no login. */
  id: string;
  saltB64: string;
  hashB64: string;
  token: string;
  user: SessionUser;
  /** Epoch ms até quando o login offline é aceito (ancorado ao login online). */
  validoAte: number;
}

export interface SessaoRestaurada {
  token: string;
  user: SessionUser;
  validoAte: number;
}

function normId(id: string): string {
  return id.trim().toLowerCase();
}

function b64(buf: ArrayBuffer): string {
  let s = "";
  for (const byte of new Uint8Array(buf)) s += String.fromCharCode(byte);
  return btoa(s);
}

function bytesFromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derivar(senha: string, salt: BufferSource): Promise<string> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(senha) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERACOES, hash: "SHA-256" },
    baseKey,
    256,
  );
  return b64(bits);
}

/** Comparação em tempo constante — evita timing-leak na verificação local. */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Grava o verificador local + a sessão. Chamado no login online bem-sucedido. */
export async function salvarCredencialOffline(
  identificador: string,
  senha: string,
  token: string,
  user: SessionUser,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const cred: CredOffline = {
      id: normId(identificador),
      saltB64: b64(salt.buffer),
      hashB64: await derivar(senha, salt),
      token,
      user,
      validoAte: Date.now() + VALIDADE_MS,
    };
    localStorage.setItem(KEY, JSON.stringify(cred));
  } catch {
    /* sem crypto/storage — segue só com a janela de sessão */
  }
}

/**
 * Valida usuário+senha localmente (offline). Devolve a sessão a restaurar, ou
 * null se não bater, expirou ou não há credencial. Remove a credencial vencida.
 */
export async function loginOffline(
  identificador: string,
  senha: string,
): Promise<SessaoRestaurada | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const cred = JSON.parse(raw) as CredOffline;
    if (cred.id !== normId(identificador)) return null;
    if (Date.now() >= cred.validoAte) {
      localStorage.removeItem(KEY);
      return null;
    }
    const hash = await derivar(senha, bytesFromB64(cred.saltB64));
    if (!igual(hash, cred.hashB64)) return null;
    return { token: cred.token, user: cred.user, validoAte: cred.validoAte };
  } catch {
    return null;
  }
}

/** Esquece a credencial deste aparelho (logout explícito). */
export function limparCredencialOffline(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}
