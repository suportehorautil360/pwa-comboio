import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type InputWithSuffixProps = React.ComponentProps<typeof Input> & {
  suffix: string;
};

export function InputWithSuffix({
  suffix,
  className,
  ...props
}: InputWithSuffixProps) {
  return (
    <div className="relative">
      <Input
        className={cn("h-11 pr-10 text-base tabular-nums md:text-base", className)}
        {...props}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}
