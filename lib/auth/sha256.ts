/**
 * SHA-256 hex — paridade EXATA com o back (`createHash('sha256')...digest('hex')`)
 * e com o hash do funcionário (salgado com o CPF). Usado pra validar a senha
 * localmente no login offline multiusuário (roster), sem rede.
 */
import { limparCpf } from "../ponto/cpf";

export async function sha256hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash salgado com o CPF, idêntico ao back: SHA-256("<cpf>:<senha>"). */
export async function hashSenhaFuncionario(
  cpf: string,
  senha: string,
): Promise<string> {
  return sha256hex(`${limparCpf(cpf)}:${senha}`);
}
