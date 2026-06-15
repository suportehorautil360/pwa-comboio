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
  ORIGENS_CARGA,
  type ReabastecimentoSource,
} from "@/lib/api/reabastecimento";
import { listarComboiosDoMotorista, type ComboioItem } from "@/lib/api/comboios";
import { submit } from "@/lib/offline/outbox";
import {
  getComboioSelecionado,
  getSessionUser,
  setComboioSelecionado,
} from "@/lib/session";

export function ComboioRefillScreen() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [comboios, setComboios] = useState<ComboioItem[]>([]);
  const [comboioId, setComboioId] = useState("");
  const [source, setSource] = useState<ReabastecimentoSource>("gasStation");
  const [liters, setLiters] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    const user = getSessionUser();
    if (!user?.prefeituraId || !user.funcionarioId) {
      router.push("/");
      return;
    }
    const pid = user.prefeituraId;
    const fid = user.funcionarioId;
    let ativo = true;
    void (async () => {
      if (ativo) setNome(user.nome);
      try {
        const lista = await listarComboiosDoMotorista(pid, fid);
        if (!ativo) return;
        setComboios(lista);
        const salvo = getComboioSelecionado();
        setComboioId(
          (salvo && lista.some((c) => c.id === salvo) && salvo) ||
            lista[0]?.id ||
            "",
        );
      } catch {
        if (ativo) setComboios([]);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [router]);

  function trocarComboio(id: string) {
    setComboioId(id);
    setComboioSelecionado(id);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setSucesso("");

    const litrosNum = Number(liters);
    if (!comboioId) {
      setErro("Selecione o comboio que está reabastecendo.");
      return;
    }
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
      const { synced } = await submit("reabastecimento", {
        prefeituraId: user.prefeituraId,
        comboioId,
        funcionarioId: user.funcionarioId,
        sourceType: source,
        receivedLiters: litrosNum,
        invoiceNumber: invoiceNumber.trim() || undefined,
      });
      setSucesso(
        synced
          ? "Carga registrada no comboio!"
          : "Sem sinal agora — salvo no aparelho, sincroniza sozinho.",
      );
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
          <FormFieldLabel htmlFor="comboio" required>
            Comboio
          </FormFieldLabel>
          <Select
            value={comboioId}
            onValueChange={trocarComboio}
            disabled={comboios.length === 0}
          >
            <SelectTrigger id="comboio" className="h-11 w-full">
              <SelectValue
                placeholder={
                  comboios.length
                    ? "Selecione o comboio"
                    : "Nenhum comboio disponível"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {comboios.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.descricao}
                  {c.placa ? ` · ${c.placa}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
            Funciona offline — sincroniza sozinho quando voltar o sinal.
          </p>
        </div>
      </form>
    </div>
  );
}
