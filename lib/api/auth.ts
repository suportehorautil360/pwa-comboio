/** Autenticação — POST /user/auth/login (NestJS). */
import { api } from "./client";
import type { SessionUser } from "../session";

interface LoginResponse {
  ok: boolean;
  msg?: string;
  message?: string;
  user?: SessionUser;
  accessToken?: string;
  tokenType?: string;
  expiresIn?: string;
}

export async function login(
  usuario: string,
  senha: string,
): Promise<{ token: string; user: SessionUser }> {
  const r = await api.post<LoginResponse>("/user/auth/login", {
    usuario,
    senha,
  });
  if (!r.ok || !r.accessToken || !r.user) {
    throw new Error(r.msg ?? r.message ?? "Login ou senha inválidos.");
  }
  return { token: r.accessToken, user: r.user };
}
