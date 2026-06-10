"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FacingMode = "environment" | "user";

type PhotoUploadProps = {
  className?: string;
  onSelect?: (file: File | null) => void;
  /** Lente inicial: "environment" (traseira, padrão) ou "user" (frontal/selfie). */
  defaultFacing?: FacingMode;
  /** Texto do botão e título da câmera. */
  label?: string;
};

/** Câmera (getUserMedia) só funciona em contexto seguro: https ou localhost. */
function temCamera(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    window.isSecureContext
  );
}

export function PhotoUpload({
  className,
  onSelect,
  defaultFacing = "environment",
  label = "Tirar foto do painel",
}: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<string | null>(null);

  const [cameraAberta, setCameraAberta] = useState(false);
  const [facing, setFacing] = useState<FacingMode>(defaultFacing);
  const [erroCamera, setErroCamera] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const pararStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const definirPreview = useCallback((url: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreview(url);
  }, []);

  // Liga a câmera quando abre (ou ao trocar de lente).
  useEffect(() => {
    if (!cameraAberta) return;
    let cancelado = false;

    void (async () => {
      try {
        pararStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
      } catch {
        if (!cancelado) {
          setErroCamera(
            "Não foi possível acessar a câmera. Você pode enviar uma foto do dispositivo.",
          );
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [cameraAberta, facing, pararStream]);

  // Limpeza final (stream + url do preview).
  useEffect(() => {
    return () => {
      pararStream();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, [pararStream]);

  function abrir() {
    setErroCamera("");
    if (temCamera()) {
      setCameraAberta(true);
    } else {
      // Sem câmera in-app (ex.: navegador antigo): cai no input nativo.
      fileInputRef.current?.click();
    }
  }

  function fechar() {
    pararStream();
    setCameraAberta(false);
  }

  function trocarLente() {
    setErroCamera("");
    setFacing((f) => (f === "environment" ? "user" : "environment"));
  }

  function usarArquivo() {
    fileInputRef.current?.click();
  }

  function capturar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `medidor-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onSelect?.(file);
        definirPreview(URL.createObjectURL(blob));
        fechar();
      },
      "image/jpeg",
      0.85,
    );
  }

  function onArquivo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onSelect?.(file);
      definirPreview(URL.createObjectURL(file));
    }
    event.target.value = "";
  }

  function remover() {
    definirPreview(null);
    onSelect?.(null);
  }

  return (
    <>
      {preview ? (
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-border bg-muted/20",
            className,
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Foto do medidor"
            className="max-h-64 w-full object-contain"
          />
          <div className="flex items-center justify-between gap-2 border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={abrir}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Tirar outra
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-destructive hover:text-destructive"
              onClick={remover}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={abrir}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 transition-colors hover:bg-muted/40",
            className,
          )}
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Camera className="size-5" aria-hidden />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onArquivo}
      />

      {cameraAberta ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black">
          <div className="flex items-center justify-between p-4 text-white">
            <button
              type="button"
              onClick={fechar}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              aria-label="Fechar câmera"
            >
              <X className="size-5" aria-hidden />
            </button>
            <span className="text-sm font-medium">{label}</span>
            <button
              type="button"
              onClick={trocarLente}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              aria-label="Trocar câmera"
            >
              <RefreshCw className="size-5" aria-hidden />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {erroCamera ? (
              <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center text-white">
                <Camera className="size-10 text-white/60" aria-hidden />
                <p className="text-sm text-white/80">{erroCamera}</p>
                <Button
                  type="button"
                  variant="brand"
                  className="gap-2"
                  onClick={usarArquivo}
                >
                  <Upload className="size-4" aria-hidden />
                  Enviar arquivo
                </Button>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="size-full object-contain"
              />
            )}
          </div>

          {!erroCamera ? (
            <div className="flex items-center justify-center gap-8 p-6">
              <button
                type="button"
                onClick={usarArquivo}
                className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Enviar arquivo do dispositivo"
              >
                <Upload className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={capturar}
                className="flex size-16 items-center justify-center rounded-full bg-white ring-4 ring-white/30 transition-transform active:scale-95"
                aria-label="Capturar foto"
              >
                <span className="size-12 rounded-full border-2 border-black/20" />
              </button>
              <span className="size-12" aria-hidden />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
