/** Helpers de CPF para o comprovante de ponto (CRPT). */

export function limparCpf(cpf: string): string {
  return (cpf ?? "").replace(/\D/g, "");
}

export function formatarCpf(cpf: string): string {
  const d = limparCpf(cpf).padStart(11, "0").slice(0, 11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}
