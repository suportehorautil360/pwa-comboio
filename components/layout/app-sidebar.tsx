"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Settings,
  Settings2,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { brand, navigation } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  FileText,
  Building2,
  Wrench,
  Settings2,
  ClipboardCheck,
  BarChart3,
  Settings,
};

function BrandLogo() {
  return (
    <div className="flex items-center gap-3 px-4 py-5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 ring-1 ring-brand/30">
        <Settings2 className="size-5 text-brand" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight text-foreground">
          {brand.name}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {brand.tagline}
        </p>
      </div>
    </div>
  );
}

type AppSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
        className
      )}
    >
      <BrandLogo />
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-4" aria-label="Navegação principal">
          {navigation.groups.map((group) => (
            <div key={group.label}>
              <p className="nav-section-label">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = iconMap[item.icon];
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2.5 rounded-r-md border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          isActive && "nav-item-active"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
