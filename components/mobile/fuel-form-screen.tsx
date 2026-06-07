"use client";

import { useState } from "react";
import { MapPin, Wifi } from "lucide-react";

import { FieldHeader } from "@/components/mobile/field-header";
import { FormFieldLabel } from "@/components/mobile/form-field-label";
import { InputWithSuffix } from "@/components/mobile/input-with-suffix";
import {
  MeasurementToggle,
  type MeasurementType,
} from "@/components/mobile/measurement-toggle";
import { PageBackHeader } from "@/components/mobile/page-back-header";
import { PhotoUpload } from "@/components/mobile/photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LAST_READING = 4812;

export function FuelFormScreen() {
  const [measurement, setMeasurement] = useState<MeasurementType>("horimetro");
  const [isSaving, setIsSaving] = useState(false);

  const readingUnit = measurement === "horimetro" ? "h" : "km";
  const lastReadingLabel =
    measurement === "horimetro"
      ? `${LAST_READING.toLocaleString("pt-BR")} h`
      : "—";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 800);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <FieldHeader />

      <PageBackHeader eyebrow="Lançamento" title="Abastecer" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <FormFieldLabel htmlFor="equipment" required>
            Placa ou chassi do equipamento
          </FormFieldLabel>
          <Input
            id="equipment"
            name="equipment"
            placeholder="Ex: ABC-1234"
            className="h-11 uppercase md:text-base"
            required
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Digite e o app busca no cadastro offline. Não encontrou? Cadastra na
            hora.
          </p>
        </div>

        <div className="space-y-2">
          <FormFieldLabel htmlFor="liters" required>
            Litros abastecidos
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
            required
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
            required
          />
          {measurement === "horimetro" && (
            <p className="text-xs text-muted-foreground">
              Última leitura registrada: {lastReadingLabel}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <FormFieldLabel>Foto do medidor (opcional)</FormFieldLabel>
          <PhotoUpload />
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
          <span>GPS capturado · Talhão 14 · -23.41, -51.93</span>
        </div>

        <div className="space-y-3 pt-2">
          <Button
            type="submit"
            variant="brand"
            className="h-12 w-full text-sm font-semibold uppercase tracking-wide"
            disabled={isSaving}
          >
            {isSaving ? "Salvando…" : "Salvar abastecimento"}
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
