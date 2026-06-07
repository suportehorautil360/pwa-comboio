"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
} from "lucide-react";

import { MetricCard } from "@/components/design-system/metric-card";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brand, colors, density, typography } from "@/lib/design-system";

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function ColorSwatch({
  name,
  hex,
  className,
}: {
  name: string;
  hex: string;
  className: string;
}) {
  return (
    <div className="space-y-2">
      <div className={className + " h-16 rounded-lg ring-1 ring-border"} />
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="font-mono text-xs text-muted-foreground">{hex}</p>
      </div>
    </div>
  );
}

export function DesignSystemShowcase() {
  return (
    <AppShell
      headerTitle="Design System"
      headerSubtitle="Documentação v1.0 — HORA ÚTIL 360"
    >
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Voltar ao Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Design System
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Sistema de design enterprise para {brand.name}. Construído com
              Next.js 16, shadcn/ui, Tailwind CSS v4 e Lucide React. Mobile
              first, otimizado para PWA.
            </p>
          </div>
        </div>

        <Tabs defaultValue="fundamentos" className="space-y-8">
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="fundamentos">Fundamentos</TabsTrigger>
            <TabsTrigger value="componentes">Componentes</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="padroes">Padrões</TabsTrigger>
          </TabsList>

          <TabsContent value="fundamentos" className="space-y-10">
            <Section
              id="cores"
              title="Cores"
              description="Paleta baseada em navy escuro com laranja como cor de destaque (Safety Orange)."
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ColorSwatch
                  name={colors.brand.navy.label}
                  hex={colors.brand.navy.hex}
                  className="bg-[#0a0e17]"
                />
                <ColorSwatch
                  name={colors.brand.slate.label}
                  hex={colors.brand.slate.hex}
                  className="bg-[#161b26]"
                />
                <ColorSwatch
                  name={colors.brand.orange.label}
                  hex={colors.brand.orange.hex}
                  className="bg-brand"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(colors.semantic).map(([key, token]) => (
                  <Card key={key} size="sm">
                    <CardContent className="flex items-center gap-2 pt-0">
                      <div
                        className="size-3 rounded-full"
                        style={{ background: token.css }}
                      />
                      <span className="text-sm">{token.label}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>

            <Separator />

            <Section
              id="tipografia"
              title="Tipografia"
              description="Geist Sans para interface; Geist Mono para dados tabulares e código."
            >
              <Card>
                <CardContent className="space-y-6 pt-0">
                  {Object.entries(typography.scale).map(([key, scale]) => (
                    <div key={key} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <span className={scale.class}>
                        {key === "metric" ? "1.234" : key === "label" ? "Label" : "HORA ÚTIL 360"}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {scale.size} / {scale.weight}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </Section>

            <Separator />

            <Section
              id="densidade"
              title="Densidade"
              description="Dois modos de densidade para interfaces enterprise."
            >
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(density).map(([key, d]) => (
                  <Card key={key}>
                    <CardHeader>
                      <CardTitle className="capitalize">{key}</CardTitle>
                      <CardDescription>
                        gap: {d.gap} · padding: {d.padding}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className={d.padding + " " + d.gap + " flex flex-col border-t"}>
                      <div className="h-8 rounded-md bg-muted" />
                      <div className="h-8 rounded-md bg-muted" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="componentes" className="space-y-10">
            <Section id="botoes" title="Botões">
              <Card>
                <CardContent className="flex flex-wrap gap-3 pt-0">
                  <Button variant="brand">Brand (CTA)</Button>
                  <Button variant="default">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link</Button>
                </CardContent>
              </Card>
            </Section>

            <Section id="badges" title="Badges & Status">
              <Card>
                <CardContent className="flex flex-wrap gap-3 pt-0">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge className="bg-success/15 text-success hover:bg-success/20">
                    <CheckCircle2 className="size-3" /> Ativo
                  </Badge>
                  <Badge className="bg-warning/15 text-warning hover:bg-warning/20">
                    <AlertTriangle className="size-3" /> Pendente
                  </Badge>
                  <Badge className="bg-info/15 text-info hover:bg-info/20">
                    <Info className="size-3" /> Info
                  </Badge>
                  <Badge variant="destructive">
                    <XCircle className="size-3" /> Erro
                  </Badge>
                </CardContent>
              </Card>
            </Section>

            <Section id="formularios" title="Formulários">
              <Card>
                <CardContent className="grid max-w-md gap-4 pt-0">
                  <div className="space-y-2">
                    <Label htmlFor="ds-nome">Nome da locatária</Label>
                    <Input id="ds-nome" placeholder="Ex: Locatária Demo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ds-cnpj">CNPJ</Label>
                    <Input id="ds-cnpj" placeholder="00.000.000/0001-00" />
                  </div>
                  <Button variant="brand">Salvar</Button>
                </CardContent>
              </Card>
            </Section>

            <Section id="metricas" title="Cards de Métrica">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Clientes" value={12} />
                <MetricCard label="Equipamentos" value={48} />
                <MetricCard label="Manutenções" value={3} />
                <MetricCard label="Checklists" value={7} />
              </div>
            </Section>

            <Section id="tabelas" title="Tabelas de Dados">
              <Card className="overflow-hidden">
                <CardContent className="p-0 pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-table-header">Nome</TableHead>
                        <TableHead className="text-table-header">Status</TableHead>
                        <TableHead className="text-table-header text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4 text-muted-foreground" />
                            Locatária Demo
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-success/15 text-success">Ativa</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="brand" size="sm">
                            Abrir painel
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Section>
          </TabsContent>

          <TabsContent value="layout" className="space-y-10">
            <Section
              id="shell"
              title="App Shell"
              description="Layout principal com sidebar fixa (desktop) e sheet mobile."
            >
              <Card>
                <CardContent className="space-y-3 pt-0 text-sm text-muted-foreground">
                  <p>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                      AppShell
                    </code>{" "}
                    compõe sidebar + header + área de conteúdo.
                  </p>
                  <ul className="list-inside list-disc space-y-1">
                    <li>Sidebar: 256px (w-64), fixa em md+</li>
                    <li>Header: 56px (h-14), sticky no mobile</li>
                    <li>Conteúdo: padding responsivo p-4 md:p-6</li>
                    <li>Navegação mobile via Sheet lateral</li>
                  </ul>
                </CardContent>
              </Card>
            </Section>

            <Section id="navegacao" title="Navegação">
              <Card>
                <CardContent className="space-y-2 pt-0">
                  <p className="text-sm text-muted-foreground">
                    Grupos em caixa alta com tracking amplo. Item ativo: borda
                    laranja à esquerda + fundo brand-muted.
                  </p>
                  <div className="rounded-lg border border-border bg-sidebar p-2">
                    <p className="nav-section-label">Principal</p>
                    <div className="nav-item-active rounded-r-md px-3 py-2 text-sm">
                      Dashboard
                    </div>
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Clientes
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Section>
          </TabsContent>

          <TabsContent value="padroes" className="space-y-10">
            <Section
              id="principios"
              title="Princípios de Design"
            >
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  {
                    title: "Enterprise First",
                    desc: "Alta densidade de informação sem sacrificar legibilidade.",
                  },
                  {
                    title: "Mobile First",
                    desc: "Layouts empilháveis, navegação via sheet, touch targets adequados.",
                  },
                  {
                    title: "Consistência",
                    desc: "Tokens semânticos — nunca cores hex soltas em componentes.",
                  },
                  {
                    title: "Acessibilidade",
                    desc: "Contraste WCAG AA, aria-labels, foco visível, navegação por teclado.",
                  },
                ].map((item) => (
                  <Card key={item.title}>
                    <CardHeader>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription>{item.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </Section>

            <Section id="uso-tokens" title="Como Usar Tokens">
              <Card>
                <CardContent className="space-y-4 pt-0 font-mono text-xs">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-foreground">
{`// ✅ Correto — tokens semânticos
<div className="bg-card text-foreground border-border" />
<Button variant="brand">CTA</Button>
<p className="text-muted-foreground">Label secundário</p>

// ❌ Evitar — valores arbitrários
<div className="bg-[#161b26] text-[#f97316]" />`}
                  </pre>
                </CardContent>
              </Card>
            </Section>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
