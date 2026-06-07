import { Settings2 } from "lucide-react";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { brand } from "@/lib/design-system";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
          <Settings2 className="size-6 text-brand" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{brand.name}</h1>
          <p className="text-sm text-muted-foreground">{brand.tagline}</p>
        </div>
      </div>

      <Card className="w-full max-w-sm ring-border/50">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>
            Acesse sua conta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Esqueceu a senha?{" "}
        <Link href="#" className="text-primary hover:underline">
          Recuperar acesso
        </Link>
      </p>
    </div>
  );
}
