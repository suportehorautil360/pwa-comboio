"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { takeFlash } from "@/lib/flash";

/**
 * Toast leve consumido ao montar a tela de destino (ex.: dashboard após salvar
 * um lançamento). Some sozinho. Sem dependência externa.
 */
export function FlashToast() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const m = takeFlash();
    if (!m) return;
    queueMicrotask(() => setMsg(m));
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, []);

  if (!msg) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-4 z-50 mx-auto flex w-fit max-w-[90%] items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 shadow-lg backdrop-blur"
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      {msg}
    </div>
  );
}
