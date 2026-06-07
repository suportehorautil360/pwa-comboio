import { cn } from "@/lib/utils";

type FormFieldLabelProps = {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function FormFieldLabel({
  htmlFor,
  required,
  children,
  className,
}: FormFieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground",
        className
      )}
    >
      {children}
      {required && (
        <span className="text-brand" aria-hidden>
          {" "}
          *
        </span>
      )}
    </label>
  );
}
