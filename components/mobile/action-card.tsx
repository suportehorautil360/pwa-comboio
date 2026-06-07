import Link from "next/link";
import { type LucideIcon, ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ActionCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  className?: string;
  featured?: boolean;
  href?: string;
};

export function ActionCard({
  icon: Icon,
  title,
  subtitle,
  className,
  featured,
  href,
}: ActionCardProps) {
  const content = (
    <CardContent className="flex items-center gap-3 pt-0">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          featured ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {subtitle}
        </p>
      </div>
      {featured && (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </CardContent>
  );

  const cardClassName = cn(
    "ring-border/50 transition-colors",
    href && "cursor-pointer hover:bg-muted/30 active:bg-muted/50",
    featured && "ring-brand/20",
    className
  );

  if (href) {
    return (
      <Link href={href} className="block">
        <Card className={cardClassName}>{content}</Card>
      </Link>
    );
  }

  return <Card className={cardClassName}>{content}</Card>;
}
