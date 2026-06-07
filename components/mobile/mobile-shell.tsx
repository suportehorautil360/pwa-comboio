import { BottomNav } from "@/components/mobile/bottom-nav";

type MobileShellProps = {
  children: React.ReactNode;
};

export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
