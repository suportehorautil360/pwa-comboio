/** Sessão do comboista (token + dados do usuário) persistida no localStorage. */

export interface SessionUser {
  nome: string;
  usuario: string;
  perfil: string;
  vinculo: string;
  prefeituraId: string;
  postoId?: string | null;
  /** CPF do funcionário — compõe o ledger do ponto (Portaria 671). */
  cpf?: string;
  /** Id do funcionário — identidade do ponto por pessoa (gate diário). */
  funcionarioId?: string;
}

const TOKEN_KEY = "hu360_token";
const USER_KEY = "hu360_user";
const COMBOIO_KEY = "hu360_comboio";
/** Limite da janela de uso offline (epoch ms): após isso, exige novo login. */
const TRUSTED_KEY = "hu360_trusted_until";

/**
 * Janela de confiança offline: enquanto dentro dela, o app abre e opera sem
 * rede mesmo que o JWT já tenha vencido (o servidor revalida quando online). A
 * janela desliza a cada contato bem-sucedido com o back ({@link touchSession}).
 * Alinhado ao app principal (sessão + credencial de 7 dias).
 */
const TRUST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Converte o `expiresIn` do back (string "7d"/"15m"/"3600s"/"3600" ou número de
 * segundos) em milissegundos. Cai no `fallbackMs` quando ausente/ inválido.
 * Pura — testável sem o browser.
 */
export function parseExpiresMs(
  expiresIn: string | number | undefined,
  fallbackMs: number,
): number {
  if (typeof expiresIn === "number") return expiresIn * 1000;
  if (!expiresIn) return fallbackMs;
  const m = /^(\d+)\s*([smhd])?$/.exec(expiresIn.trim());
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const mult =
    m[2] === "d"
      ? 86_400_000
      : m[2] === "h"
        ? 3_600_000
        : m[2] === "m"
          ? 60_000
          : 1_000; // sem sufixo ou "s" → segundos
  return n * mult;
}

function setTrustedUntil(value: number): void {
  try {
    localStorage.setItem(TRUSTED_KEY, String(value));
  } catch {
    /* ignora */
  }
}

export function saveSession(
  token: string,
  user: SessionUser,
  expiresIn?: string | number,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    // A janela confiável é o maior entre o TTL do token e o piso de 7 dias.
    const ttl = parseExpiresMs(expiresIn, TRUST_WINDOW_MS);
    setTrustedUntil(Date.now() + Math.max(ttl, TRUST_WINDOW_MS));
  } catch {
    /* storage indisponível — ignora */
  }
}

/** Renova a janela de confiança — chamada a cada resposta 2xx autenticada. */
export function touchSession(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(TOKEN_KEY)) {
      setTrustedUntil(Date.now() + TRUST_WINDOW_MS);
    }
  } catch {
    /* ignora */
  }
}

/** Sessão expirada de vez (passou da janela confiável) → exige novo login. */
export function isSessionExpired(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(TRUSTED_KEY);
    if (!raw) return false; // sessão antiga sem o campo: não expira retroativo
    return Date.now() >= Number(raw);
  } catch {
    return false;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    if (isSessionExpired()) {
      clearSession();
      return null;
    }
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(COMBOIO_KEY);
    localStorage.removeItem(TRUSTED_KEY);
  } catch {
    /* ignora */
  }
}

/** Comboio selecionado pelo comboista no turno atual (persistido entre telas). */
export function getComboioSelecionado(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(COMBOIO_KEY);
  } catch {
    return null;
  }
}

export function setComboioSelecionado(comboioId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COMBOIO_KEY, comboioId);
  } catch {
    /* ignora */
  }
}
