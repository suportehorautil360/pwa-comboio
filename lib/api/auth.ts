/** Autenticação do operador/comboista — POST /funcionarios/auth/login (NestJS). */
import { api } from "./client";
import type { SessionUser } from "../session";

interface FuncionarioAuth {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  loginGerado: string;
  prefeituraId: string;
}

interface LoginResponse {
  ok: boolean;
  msg?: string;
  message?: string;
  funcionario?: FuncionarioAuth;
  accessToken?: string;
  tokenType?: string;
  expiresIn?: string;
}

/** Login por CPF (11 dígitos) ou login gerado (nome + 3 dígitos do CPF). */
export async function login(
  identificador: string,
  senha: string,
): Promise<{ token: string; user: SessionUser; expiresIn?: string }> {
  const r = await api.post<LoginResponse>("/funcionarios/auth/login", {
    identificador,
    senha,
  });
  if (!r.ok || !r.accessToken || !r.funcionario) {
    throw new Error(r.msg ?? r.message ?? "Identificador ou senha incorretos.");
  }
  const f = r.funcionario;
  return {
    token: r.accessToken,
    expiresIn: r.expiresIn,
    user: {
      nome: f.nome,
      usuario: f.loginGerado || f.cpf,
      perfil: f.cargo,
      vinculo: "operador",
      prefeituraId: f.prefeituraId,
      cpf: f.cpf,
      funcionarioId: f.id,
    },
  };
}
