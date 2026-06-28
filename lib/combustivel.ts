/**
 * Família de combustível — espelha `fleetfuel-rules.helper` do back (PWA comboio = só diesel).
 */
function familiaCombustivel(valor: unknown): string {
  const v =
    typeof valor === "string"
      ? valor
      : typeof valor === "number" || typeof valor === "boolean"
        ? String(valor)
        : "";
  const n = v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (!n) return "desconhecido";
  if (n.includes("flex")) return "desconhecido";
  if (n.includes("diesel")) return "diesel";
  if (n.includes("gnv") || n.includes("gas natural")) return "gnv";
  if (n.includes("etanol") || n.includes("alcool")) return "etanol";
  if (n.includes("gasolina")) return "gasolina";
  return "desconhecido";
}

/** Equipamento elegível para abastecimento no PWA do comboio. */
export function ehCombustivelDiesel(valor: unknown): boolean {
  return familiaCombustivel(valor) === "diesel";
}
