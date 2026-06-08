/** Sessão do comboista (token + dados do usuário) persistida no localStorage. */

export interface SessionUser {
  nome: string;
  usuario: string;
  perfil: string;
  vinculo: string;
  prefeituraId: string;
  postoId?: string | null;
}

const TOKEN_KEY = "hu360_token";
const USER_KEY = "hu360_user";

export function saveSession(token: string, user: SessionUser): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* storage indisponível — ignora */
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
  } catch {
    /* ignora */
  }
}
