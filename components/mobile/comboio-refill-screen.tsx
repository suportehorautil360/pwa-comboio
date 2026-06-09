"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wifi } from "lucide-react";

import { FieldHeader } from "@/components/mobile/field-header";
import { FormFieldLabel } from "@/components/mobile/form-field-label";
import { InputWithSuffix } from "@/components/mobile/input-with-suffix";
import { PageBackHeader } from "@/components/mobile/page-back-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  criarReabastecimento,
  ORIGENS_CARGA,
  type ReabastecimentoSource,
} from "@/lib/api/reabastecimento";
import { getSessionUser } from "@/lib/session";

export function ComboioRefillScreen() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [source, setSource] = useState<ReabastecimentoSource>("gasStation");
  const [liters, setLiters] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    const user = getSessionUser();
    if (!user?.prefeituraId) {
      router.push("/");
      return;
    }
    void (async () => {
      setNome(user.nome);
    })();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setSucesso("");

    const litrosNum = Number(liters);
    if (!(litrosNum > 0)) {
      setErro("Informe os litros recebidos.");
      return;
    }

    const user = getSessionUser();
    if (!user?.prefeituraId) {
      setErro("Sessão expirada. Faça login novamente.");
      return;
    }

    setIsSaving(true);
    try {
      await criarReabastecimento({
        prefeituraId: user.prefeituraId,
        sourceType: source,
        receivedLiters: litrosNum,
        invoiceNumber: invoiceNumber.trim() || undefined,
      });
      setSucesso("Carga do comboio registrada!");
      setLiters("");
      setInvoiceNumber("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <FieldHeader nome={nome} />

      <PageBackHeader eyebrow="Lançamento" title="Reabastecer comboio" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <FormFieldLabel htmlFor="source" required>
            Origem da carga
          </FormFieldLabel>
          <Select
            value={source}
            onValueChange={(v) => setSource(v as ReabastecimentoSource)}
          >
            <SelectTrigger id="source" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORIGENS_CARGA.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="liters" required>
            Litros recebidos
          </FormFieldLabel>
          <InputWithSuffix
            id="liters"
            name="liters"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            placeholder="0"
            suffix="L"
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="invoice">Nota fiscal</FormFieldLabel>
          <Input
            id="invoice"
            name="invoice"
            placeholder="Ex.: NF 0455123"
            className="h-11 md:text-base"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
        </div>

        {erro ? (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        ) : null}
        {sucesso ? (
          <p className="text-sm font-medium text-emerald-500" role="status">
            {sucesso}
          </p>
        ) : null}

        <div className="space-y-3 pt-2">
          <Button
            type="submit"
            variant="brand"
            className="h-12 w-full text-sm font-semibold uppercase tracking-wide"
            disabled={isSaving}
          >
            {isSaving ? "Salvando…" : "Salvar carga"}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Wifi className="size-3.5 shrink-0" aria-hidden />
            Salva no aparelho e sincroniza quando houver sinal
          </p>
        </div>
      </form>
    </div>
  );
}
