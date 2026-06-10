"use client";

import { useState } from "react";
import { ArrowLeft, Camera, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TIPOS_PONTO, type TipoPonto } from "@/lib/api/ponto";
import type { BatidaEfetiva } from "@/lib/ponto/resolver-ledger";

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dataBr(diaIso: string): string {
  return diaIso.split("-").reverse().join("/");
}

/**
 * Detalhe de um dia no espelho do operador: cada batida (entrada/almoço/volta/
 * saída) com a selfie registrada, horário e aviso de correção pendente.
 * Somente leitura.
 */
export function DiaDetalhe({
  dia,
  batidas,
  onVoltar,
  onEditar,
}: {
  dia: string;
  batidas: BatidaEfetiva[];
  onVoltar: () => void;
  /** Quando definido, mostra "Editar" em cada batida existente. */
  onEditar?: (b: BatidaEfetiva) => void;
}) {
  const [fotoAmpliada, setFotoAmpliada] = useState("");

  const porTipo = new Map<TipoPonto, BatidaEfetiva>();
  for (const b of batidas) porTipo.set(b.tipo, b);

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon-sm" onClick={onVoltar}>
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">
          Dia {dataBr(dia)}
        </h1>
      </div>

      <Card className="ring-border/50">
        <CardContent className="space-y-1 pt-0">
          {TIPOS_PONTO.map(({ tipo, label }) => {
            const reg = porTipo.get(tipo);
            return (
              <div key={tipo} className="border-t border-border py-2.5">
                <div className="flex items-center gap-3">
                  {reg?.photo ? (
                    <button
                      type="button"
                      className="size-12 shrink-0 overflow-hidden rounded-lg"
                      onClick={() => setFotoAmpliada(reg.photo ?? "")}
                      aria-label="Ampliar selfie"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={reg.photo}
                        alt={`Selfie ${label}`}
                        className="size-full object-cover"
                      />
                    </button>
                  ) : (
                    <span
                      className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                      aria-hidden
                    >
                      <Camera className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {label}
                  </span>
                  <div className="flex flex-col items-end gap-0.5">
                    <strong className="tabular-nums text-sm">
                      {reg ? horaDe(reg.timestampOriginal) : "—:—"}
                    </strong>
                    {reg?.ajustePendente ? (
                      <span className="text-[11px] text-amber-500">
                        Ajuste pendente
                      </span>
                    ) : null}
                  </div>
                  {reg && onEditar ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar horário"
                      onClick={() => onEditar(reg)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
                {reg?.ajustePendente && reg.horarioAjustePendente ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Correção para {horaDe(reg.horarioAjustePendente)} aguardando
                    aprovação do RH.
                  </p>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {fotoAmpliada ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFotoAmpliada("")}
          role="presentation"
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoAmpliada}
            alt="Selfie ampliada"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
