# HORA ÚTIL 360 — Design System

Documentação de referência do Design System enterprise da plataforma.

## Stack

| Tecnologia | Versão | Papel |
|---|---|---|
| Next.js | 16 | App Router, RSC, PWA manifest |
| React | 19 | UI |
| TypeScript | 5 | Tipagem |
| Tailwind CSS | 4 | Utility-first styling |
| shadcn/ui | radix-nova | Componentes acessíveis |
| Lucide React | — | Iconografia |

## Identidade Visual

- **Background:** Deep Navy `#0a0e17`
- **Surface:** Slate `#161b26`
- **Accent:** Safety Orange `#f97316`
- **Texto primário:** Branco
- **Texto secundário:** Slate muted (`text-muted-foreground`)

## Estrutura de Arquivos

```
app/
  globals.css          # Tokens CSS + tema dark/light
  manifest.ts          # PWA manifest
  page.tsx             # Dashboard demo
  design-system/       # Documentação interativa

components/
  ui/                  # shadcn/ui (Button, Card, Table…)
  layout/              # AppShell, AppSidebar, AppHeader
  design-system/       # MetricCard, Showcase

lib/
  design-system/
    tokens.ts          # Tokens tipados (fonte documental)
    index.ts           # Re-exports
  utils.ts             # cn() utility
```

## Tokens Semânticos

Use sempre tokens semânticos em componentes de produto:

| Token Tailwind | Uso |
|---|---|
| `bg-background` | Fundo da página |
| `bg-card` | Cards e containers |
| `bg-sidebar` | Sidebar de navegação |
| `bg-brand` | CTAs e destaques |
| `text-foreground` | Texto principal |
| `text-muted-foreground` | Labels, captions |
| `text-primary` | Headers de tabela, links ativos |
| `border-border` | Bordas padrão |

## Componentes de Layout

### AppShell

Shell principal da aplicação. Inclui sidebar (desktop), header e navegação mobile via Sheet.

```tsx
import { AppShell } from "@/components/layout/app-shell";

<AppShell headerTitle="Dashboard">
  {children}
</AppShell>
```

### AppSidebar

Sidebar com grupos de navegação (Principal, Gestão, Controle). Item ativo detectado via `usePathname()`.

## Variantes Customizadas

### Button `variant="brand"`

CTA principal com fundo laranja e texto escuro — use para ações primárias como "Abrir painel", "Salvar".

## Utilitários CSS

| Classe | Uso |
|---|---|
| `.text-table-header` | Headers de tabela (uppercase, laranja) |
| `.nav-section-label` | Labels de grupo na sidebar |
| `.nav-item-active` | Estado ativo de navegação |

## Densidade

- **Comfortable:** `gap-6`, `p-6` — dashboards, páginas de detalhe
- **Compact:** `gap-4`, `p-4` — tabelas densas, listagens

## PWA

Manifest em `app/manifest.ts`. Tema escuro por padrão. Ícones em `public/icons/`.

## Documentação Interativa

Acesse `/design-system` para visualizar todos os tokens, componentes e padrões ao vivo.

## Princípios

1. **Mobile First** — Sheet para nav mobile, grids responsivos
2. **Tokens over hex** — nunca hardcode cores em componentes
3. **Enterprise density** — informação densa, hierarquia clara
4. **Acessibilidade** — WCAG AA, foco visível, aria-labels
