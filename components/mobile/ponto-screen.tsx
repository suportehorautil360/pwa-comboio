"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, LogOut } from "lucide-react";

import { FieldHeader } from "@/components/mobile/field-header";
import { PhotoUpload } from "@/components/mobile/photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { featureFlagsApi } from "@/lib/api/feature-flags";
import { enqueue, flushOutbox } from "@/lib/offline/outbox";
import { useOutbox } from "@/lib/offline/use-outbox";
import { marcarBatidaHoje } from "@/lib/ponto/ponto-dia";
import { clearSession, getSessionUser, type SessionUser } from "@/lib/session";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler a foto."));
    reader.readAsDataURL(file);
  });
}

function RelogioAoVivo() {
  const [hora, setHora] = useState("");

  useEffect(() => {
    const tick = () =>
      setHora(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    queueMicrotask(tick);
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/30 py-4">
      <Clock className="size-5 text-brand" aria-hidden />
      <span className="text-3xl font-semibold tabular-nums tracking-tight">
        {hora || "--:--:--"}
      </span>
    </div>
  );
}

export function PontoScreen() {
  const router = useRouter();
  const { pendentes } = useOutbox();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [pronto, setPronto] = useState(false);
  const [nome, setNome] = useState("");
  const [fotoDataUrl, setFotoDataUrl] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    const u = getSessionUser();
    if (!u) {
      router.replace("/");
      return;
    }
    void (async () => {
      const ativo = await featureFlagsApi.pontoAtivo(u.prefeituraId);
      if (!vivo) return;
      // Ponto não está ativo para a prefeitura: não há gate, volta ao app.
      if (!ativo) {
        router.replace("/dashboard");
        return;
      }
      setUser(u);
      setNome(u.nome ?? "");
      setPronto(true);
    })();
    return () => {
      vivo = false;
    };
  }, [router]);

  async function onFoto(file: File | null) {
    if (!file) {
      setFotoDataUrl("");
      return;
    }
    try {
      setFotoDataUrl(await fileToDataUrl(file));
    } catch {
      setErro("Não foi possível ler a foto. Tente de novo.");
    }
  }

  async function baterEntrada() {
    if (!user) return;
    setErro("");
    if (!nome.trim()) {
      setErro("Informe seu nome.");
      return;
    }
    if (!fotoDataUrl) {
      setErro("Capture a selfie antes de bater o ponto.");
      return;
    }
    setSalvando(true);
    try {
      await enqueue("ponto", {
        name: nome.trim(),
        photo: fotoDataUrl,
        prefeituraId: user.prefeituraId,
        timestampOriginal: new Date().toISOString(),
        tipo: "entrada",
        cpf: user.cpf,
      });
      marcarBatidaHoje(user);
      void flushOutbox();
      router.replace("/dashboard");
    } catch {
      setErro("Não foi possível registrar o ponto. Tente de novo.");
      setSalvando(false);
    }
  }

  function sair() {
    clearSession();
    router.replace("/");
  }

  if (!pronto) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col gap-6 px-4 py-6">
      <FieldHeader nome={nome} />

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Registro obrigatório
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Ponto de entrada
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bata o ponto de entrada para liberar o app.
        </p>
      </div>

      {pendentes > 0 ? (
        <p className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {pendentes} batida(s) aguardando sincronização.
        </p>
      ) : null}

      <RelogioAoVivo />

      <div className="space-y-2">
        <label htmlFor="ponto-nome" className="text-sm font-medium">
          Seu nome
        </label>
        <Input
          id="ponto-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome completo"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Selfie</span>
        <PhotoUpload
          defaultFacing="user"
          label="Tirar selfie"
          onSelect={(f) => void onFoto(f)}
        />
      </div>

      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="mt-auto space-y-3 pt-2">
        <Button
          type="button"
          variant="brand"
          className="h-12 w-full text-sm font-semibold uppercase tracking-wide"
          onClick={() => void baterEntrada()}
          disabled={salvando}
        >
          {salvando ? "Registrando…" : "Bater entrada"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full gap-2 text-muted-foreground"
          onClick={sair}
        >
          <LogOut className="size-4" aria-hidden />
          Sair
        </Button>
      </div>
    </div>
  );
}
