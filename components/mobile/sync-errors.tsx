"use client";

import { AlertTriangle, RotateCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { discardItem, flushOutbox, retryItem } from "@/lib/offline/outbox";
import { useOutboxFailed } from "@/lib/offline/use-outbox";

/**
 * Erros de sincronização (dead-letter): lançamentos que o servidor rejeitou ou
 * que esgotaram as tentativas. O operador pode reprocessar (tenta de novo agora)
 * ou descartar. Some quando não há erros.
 */
export function SyncErrors() {
  const falhos = useOutboxFailed();
  if (falhos.length === 0) return null;

  async function reprocessar(id: string) {
    await retryItem(id);
    void flushOutbox();
  }

  async function descartar(id: string, label: string) {
    if (!window.confirm(`Descartar "${label}"? Este lançamento será perdido.`)) {
      return;
    }
    await discardItem(id);
  }

  return (
    <Card className="ring-destructive/30">
      <CardContent className="space-y-3 pt-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="size-4" aria-hidden />
          Erros de sincronização
        </div>
        <p className="text-xs text-muted-foreground">
          Estes lançamentos não foram aceitos. Tente reenviar ou descarte.
        </p>
        <ul className="divide-y divide-border">
          {falhos.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.code}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.description}
                  {item.value ? ` · ${item.value}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void reprocessar(item.id)}
                >
                  <RotateCw className="size-3.5" aria-hidden />
                  Reenviar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Descartar"
                  onClick={() => void descartar(item.id, item.code)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
