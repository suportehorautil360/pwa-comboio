"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MapPin, Wifi } from "lucide-react";

import { FieldHeader } from "@/components/mobile/field-header";
import { FormFieldLabel } from "@/components/mobile/form-field-label";
import { InputWithSuffix } from "@/components/mobile/input-with-suffix";
import {
  MeasurementToggle,
  type MeasurementType,
} from "@/components/mobile/measurement-toggle";
import { PageBackHeader } from "@/components/mobile/page-back-header";
import { EquipamentoAutocomplete } from "@/components/mobile/equipamento-autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listarEquipamentos, type EquipamentoApi } from "@/lib/api/abastecimento";
import { PONTOS_ENGRAXE } from "@/lib/api/lubrificacao";
import { submit } from "@/lib/offline/outbox";
import { setFlash } from "@/lib/flash";
import { getSessionUser } from "@/lib/session";

export function GreaseFormScreen() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [equipamentos, setEquipamentos] = useState<EquipamentoApi[]>([]);

  const [equipment, setEquipment] = useState("");
  const [measurement, setMeasurement] = useState<MeasurementType>("horimetro");
  const [reading, setReading] = useState("");
  const [pontos, setPontos] = useState<string[]>([]);
  const [observation, setObservation] = useState("");

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [gpsMsg, setGpsMsg] = useState("Capturando GPS…");
  const [isSaving, setIsSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const readingUnit = measurement === "horimetro" ? "h" : "km";

  useEffect(() => {
    const user = getSessionUser();
    if (!user?.prefeituraId) {
      router.push("/");
      return;
    }
    const pid = user.prefeituraId;
    void (async () => {
      setNome(user.nome);
      try {
        setEquipamentos(await listarEquipamentos(pid));
      } catch {
        setEquipamentos([]);
      }
    })();

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      queueMicrotask(() => setGpsMsg("GPS indisponível neste dispositivo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsMsg("");
      },
      () => setGpsMsg("GPS indisponível — engraxe salvo sem localização"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [router]);

  function togglePonto(value: string) {
    setPontos((prev) =>
      prev.includes(value)
        ? prev.filter((p) => p !== value)
        : [...prev, value],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setSucesso("");

    const leituraNum = Number(reading);
    if (!equipment.trim()) {
      setErro("Informe a placa ou chassi do equipamento.");
      return;
    }
    if (!Number.isFinite(leituraNum)) {
      setErro("Informe a leitura atual.");
      return;
    }
    if (pontos.length === 0) {
      setErro("Selecione ao menos um ponto engraxado.");
      return;
    }

    const user = getSessionUser();
    if (!user?.prefeituraId) {
      setErro("Sessão expirada. Faça login novamente.");
      return;
    }

    setIsSaving(true);
    try {
      const { synced } = await submit("lubrificacao", {
        prefeituraId: user.prefeituraId,
        plateOrChassis: equipment.trim().toUpperCase(),
        comboistaNome: user.nome,
        funcionarioId: user.funcionarioId,
        reading: leituraNum,
        readingUnit,
        greasedPoints: pontos,
        observation: observation.trim() || undefined,
        latitude: coords?.lat ?? 0,
        longitude: coords?.lng ?? 0,
      });
      // Volta pro início (mesmo padrão de abastecer/reabastecer).
      setFlash(
        synced
          ? "Engraxe registrado"
          : "Salvo no aparelho — sincroniza sozinho",
      );
      router.replace("/dashboard");
      return;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <FieldHeader nome={nome} />

      <PageBackHeader eyebrow="Lançamento" title="Engraxar" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <FormFieldLabel htmlFor="equipment" required>
            Placa ou chassi do equipamento
          </FormFieldLabel>
          <EquipamentoAutocomplete
            id="equipment"
            equipamentos={equipamentos}
            value={equipment}
            onChange={setEquipment}
          />
        </div>

        <div className="space-y-2">
          <FormFieldLabel>Tipo de medição</FormFieldLabel>
          <MeasurementToggle value={measurement} onChange={setMeasurement} />
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="reading" required>
            Leitura atual
          </FormFieldLabel>
          <InputWithSuffix
            id="reading"
            name="reading"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder="0"
            suffix={readingUnit}
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <FormFieldLabel required>Pontos engraxados</FormFieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {PONTOS_ENGRAXE.map((p) => {
              const sel = pontos.includes(p.value);
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePonto(p.value)}
                  aria-pressed={sel}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    sel
                      ? "border-brand bg-brand/10 text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                      sel ? "border-brand bg-brand" : "border-muted-foreground"
                    }`}
                  >
                    {sel ? (
                      <Check className="size-3 text-background" aria-hidden />
                    ) : null}
                  </span>
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {pontos.length} ponto{pontos.length !== 1 ? "s" : ""} selecionado
            {pontos.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="observation">Observação</FormFieldLabel>
          <Input
            id="observation"
            name="observation"
            placeholder="Ex.: Ponto da lança seco"
            className="h-11 md:text-base"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
          <span>
            {coords
              ? `GPS capturado · ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
              : gpsMsg}
          </span>
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
            {isSaving ? "Salvando…" : "Salvar engraxe"}
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
