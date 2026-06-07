"use client";

import { Camera } from "lucide-react";

import { cn } from "@/lib/utils";

type PhotoUploadProps = {
  className?: string;
  onSelect?: (file: File) => void;
};

export function PhotoUpload({ className, onSelect }: PhotoUploadProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 transition-colors hover:bg-muted/40",
        className
      )}
    >
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect?.(file);
        }}
      />
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Camera className="size-5" aria-hidden />
      </div>
      <span className="text-sm font-medium">Tirar foto do painel</span>
    </label>
  );
}
