"use client";

import { Menu } from "lucide-react";
import { LogOut } from "lucide-react";

import { brand } from "@/lib/design-system";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppSidebar } from "@/components/layout/app-sidebar";

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  mobileNavOpen?: boolean;
  onMobileNavChange?: (open: boolean) => void;
};

export function AppHeader({
  title = brand.tagline,
  subtitle,
  mobileNavOpen,
  onMobileNavChange,
}: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Sheet open={mobileNavOpen} onOpenChange={onMobileNavChange}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              className="md:hidden"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{brand.name}</SheetTitle>
            </SheetHeader>
            <AppSidebar onNavigate={() => onMobileNavChange?.(false)} />
          </SheetContent>
        </Sheet>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" className="shrink-0">
        <LogOut className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </header>
  );
}
