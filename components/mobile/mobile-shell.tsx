import { BottomNav } from "@/components/mobile/bottom-nav";
import { PontoGate } from "@/components/mobile/ponto-gate";

type MobileShellProps = {
  children: React.ReactNode;
};

export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        <PontoGate>{children}</PontoGate>
      </main>
      <BottomNav />
    </div>
  );
}
