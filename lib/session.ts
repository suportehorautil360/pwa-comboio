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
    localStorage.removeItem(COMBOIO_KEY);
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
