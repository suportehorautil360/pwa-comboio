"use client";

import { useState } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
  className?: string;
};

export function AppShell({
  children,
  headerTitle,
  headerSubtitle,
  className,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-background">
      <div className="hidden md:block">
        <AppSidebar className="fixed inset-y-0 left-0 z-30" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <AppHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          mobileNavOpen={mobileOpen}
          onMobileNavChange={setMobileOpen}
        />
        <main className={cn("flex-1 p-4 md:p-6", className)}>{children}</main>
      </div>
    </div>
  );
}
