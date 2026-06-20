/**
 * Client HTTP fino para a API NestJS (back-360-).
 * Base configurável por NEXT_PUBLIC_API_URL; default = backend local.
 * Anexa o Bearer token da sessão automaticamente.
 */
import { clearSession, getToken, touchSession } from "../session";

/**
 * Sessão inválida/expirada (401) ou sem acesso àquela empresa (403): limpa a
 * sessão e volta pro login. Centralizado aqui — qualquer chamada que falhe a
 * autenticação derruba a sessão (ex.: token antigo sem funcionarioId após o
 * guard de isolamento entrar). Ignora o próprio endpoint de login.
 */
function tratarSessaoInvalida(status: number, path: string): void {
  if (status !== 401 && status !== 403) return;
  if (path.includes("/auth/login")) return;
  if (typeof window === "undefined") return;
  clearSession();
  if (window.location.pathname !== "/") {
    window.location.replace("/");
  }
}

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Opções por requisição (ex.: chave de idempotência para escritas do outbox). */
export interface RequestOptions {
  idempotencyKey?: string;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: RequestOptions,
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body != null ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.idempotencyKey
        ? { "Idempotency-Key": opts.idempotencyKey }
        : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    tratarSessaoInvalida(res.status, path);
    let message = `Erro ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data?.message) {
        message = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message;
      }
    } catch {
      /* resposta sem corpo JSON */
    }
    throw new ApiError(res.status, message);
  }

  // Contato bem-sucedido com o back: desliza a janela de confiança offline.
  touchSession();

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("POST", path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("PATCH", path, body, opts),
  del: <T>(path: string) => request<T>("DELETE", path),
};
