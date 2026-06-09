"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fuel, Home, LineChart, User } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { label: "Início", href: "/dashboard", icon: Home },
  { label: "Abastecer", href: "/abastecer", icon: Fuel },
  { label: "Histórico", href: "/historico", icon: LineChart },
  { label: "Perfil", href: "/perfil", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm"
      aria-label="Navegação principal"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-brand"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-brand"
                  aria-hidden
                />
              )}
              <Icon className="size-5 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
