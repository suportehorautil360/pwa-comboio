/**
 * HORA ÚTIL 360 — Design System Tokens
 * Fonte de verdade para tokens semânticos e de marca.
 * Valores CSS vivem em app/globals.css; este arquivo documenta e tipa o sistema.
 */

export const brand = {
  name: "HORA ÚTIL 360",
  tagline: "Hub Mestre — Controle Operacional",
  description: "Plataforma SaaS B2B de gestão operacional de frotas e equipamentos.",
} as const;

export const colors = {
  brand: {
    orange: { hex: "#f97316", label: "Safety Orange", usage: "CTAs, estados ativos, headers de tabela" },
    navy: { hex: "#0a0e17", label: "Deep Navy", usage: "Background principal" },
    slate: { hex: "#161b26", label: "Surface Slate", usage: "Cards e superfícies elevadas" },
  },
  semantic: {
    success: { css: "var(--success)", label: "Sucesso" },
    warning: { css: "var(--warning)", label: "Alerta" },
    destructive: { css: "var(--destructive)", label: "Erro / Destrutivo" },
    info: { css: "var(--info)", label: "Informação" },
  },
} as const;

export const typography = {
  fontFamily: {
    sans: '"Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono", "Geist Mono Fallback", ui-monospace, monospace',
  },
  scale: {
    display: { size: "2.25rem", lineHeight: "2.5rem", weight: 600, class: "text-4xl font-semibold tracking-tight" },
    h1: { size: "1.875rem", lineHeight: "2.25rem", weight: 600, class: "text-3xl font-semibold tracking-tight" },
    h2: { size: "1.5rem", lineHeight: "2rem", weight: 600, class: "text-2xl font-semibold" },
    h3: { size: "1.25rem", lineHeight: "1.75rem", weight: 500, class: "text-xl font-medium" },
    body: { size: "0.875rem", lineHeight: "1.25rem", weight: 400, class: "text-sm" },
    bodyLg: { size: "1rem", lineHeight: "1.5rem", weight: 400, class: "text-base" },
    caption: { size: "0.75rem", lineHeight: "1rem", weight: 400, class: "text-xs text-muted-foreground" },
    label: { size: "0.75rem", lineHeight: "1rem", weight: 500, class: "text-xs font-medium uppercase tracking-wider" },
    metric: { size: "2rem", lineHeight: "2.25rem", weight: 600, class: "text-3xl font-semibold tabular-nums" },
  },
} as const;

export const spacing = {
  page: "p-4 md:p-6",
  section: "gap-6",
  card: "p-4 md:p-6",
  compact: "gap-4 p-4",
  stack: "space-y-4",
} as const;

export const radius = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  default: "0.625rem",
} as const;

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

export const density = {
  comfortable: {
    gap: "gap-6",
    padding: "p-6",
    text: "text-sm",
  },
  compact: {
    gap: "gap-4",
    padding: "p-4",
    text: "text-sm",
  },
} as const;

export const navigation = {
  groups: [
    {
      label: "Principal",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
        { label: "Clientes", href: "/clientes", icon: "Users" },
        { label: "Contratos", href: "/contratos", icon: "FileText" },
      ],
    },
    {
      label: "Gestão",
      items: [
        { label: "Locatárias", href: "/locatarias", icon: "Building2" },
        { label: "Equipamentos", href: "/equipamentos", icon: "Wrench" },
        { label: "Manutenção", href: "/manutencao", icon: "Settings2" },
      ],
    },
    {
      label: "Controle",
      items: [
        { label: "Checklists", href: "/checklists", icon: "ClipboardCheck" },
        { label: "Relatórios", href: "/relatorios", icon: "BarChart3" },
        { label: "Configurações", href: "/configuracoes", icon: "Settings" },
      ],
    },
  ],
} as const;
