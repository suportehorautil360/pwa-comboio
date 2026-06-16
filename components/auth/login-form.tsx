"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { login } from "@/lib/api/auth";
import {
  loginOffline,
  salvarCredencialOffline,
} from "@/lib/auth/offline-credential";
import { syncAll } from "@/lib/data/sync";
import { getSessionUser, restaurarSessao, saveSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState("");
  // Já tem sessão válida (salva localmente)? Entra direto — é o que faz o app
  // "abrir logado" offline, sem bater no servidor de login. `getSessionUser`
  // devolve null se a janela confiável de 7d venceu (aí pede login mesmo).
  const [verificandoSessao, setVerificandoSessao] = useState(true);

  useEffect(() => {
    if (getSessionUser()) {
      router.replace("/dashboard");
      return;
    }
    queueMicrotask(() => setVerificandoSessao(false));
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setIsLoading(true);
    const id = usuario.trim();
    try {
      const { token, user, expiresIn } = await login(id, senha);
      saveSession(token, user, expiresIn);
      // Guarda o verificador local da senha p/ login offline depois.
      await salvarCredencialOffline(id, senha, token, user);
      // Pré-aquece os caches enquanto há rede (acabou de logar): todas as telas
      // passam a funcionar offline mesmo sem terem sido visitadas antes.
      void syncAll(user, { force: true });
      router.push("/dashboard");
    } catch (e) {
      // Sem rede? valida a senha localmente (login offline) e restaura a sessão.
      const offline = await loginOffline(id, senha);
      if (offline) {
        restaurarSessao(offline.token, offline.user, offline.validoAte);
        void syncAll(offline.user, {});
        router.push("/dashboard");
        return;
      }
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
      setIsLoading(false);
    }
  }

  // Enquanto decide (tem sessão? → dashboard), não pisca o formulário.
  if (verificandoSessao) {
    return (
      <p className="py-2 text-center text-sm text-muted-foreground">
        Carregando…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="usuario">CPF ou login</Label>
        <Input
          id="usuario"
          name="usuario"
          type="text"
          placeholder="CPF ou seu login"
          autoComplete="username"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
      </div>
      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="brand"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
