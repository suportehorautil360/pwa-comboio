import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageBackHeaderProps = {
  eyebrow: string;
  title: string;
  backHref?: string;
  className?: string;
};

export function PageBackHeader({
  eyebrow,
  title,
  backHref = "/dashboard",
  className,
}: PageBackHeaderProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Button
        variant="outline"
        size="icon-sm"
        className="mt-0.5 shrink-0"
        asChild
      >
        <Link href={backHref} aria-label="Voltar">
          <ChevronLeft className="size-4" />
        </Link>
      </Button>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </div>
    </div>
  );
}
