import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="h-0.5 w-4 shrink-0 rounded-full bg-brand" aria-hidden />
      <h2 className="text-sm font-semibold tracking-wide text-foreground">
        {title}
      </h2>
    </div>
  );
}
