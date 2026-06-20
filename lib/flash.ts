/**
 * Mensagem "flash" entre telas (ex.: confirmar um lançamento ao voltar pro
 * dashboard). Sobrevive à navegação via sessionStorage e é consumida uma vez.
 */
const KEY = "hu360_flash";

export function setFlash(msg: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, msg);
  } catch {
    /* storage indisponível — ignora */
  }
}

/** Lê e remove a mensagem (mostra só uma vez). */
export function takeFlash(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
