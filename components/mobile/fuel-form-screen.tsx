"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, TriangleAlert, Wifi } from "lucide-react";

import { FieldHeader } from "@/components/mobile/field-header";
import { FormFieldLabel } from "@/components/mobile/form-field-label";
import { InputWithSuffix } from "@/components/mobile/input-with-suffix";
import {
  MeasurementToggle,
  type MeasurementType,
} from "@/components/mobile/measurement-toggle";
import { PageBackHeader } from "@/components/mobile/page-back-header";
import { PhotoUpload } from "@/components/mobile/photo-upload";
import { EquipamentoAutocomplete } from "@/components/mobile/equipamento-autocomplete";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboioSelect } from "@/components/mobile/comboio-select";
import { useComboios, useEquipamentos, usePostos } from "@/lib/data/queries";
import { submit } from "@/lib/offline/outbox";
import { ApiError } from "@/lib/api/client";
import { setFlash } from "@/lib/flash";
import {
  getComboioSelecionado,
  getSessionUser,
  setComboioSelecionado,
  type SessionUser,
} from "@/lib/session";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler a foto."));
    reader.readAsDataURL(file);
  });
}

export function FuelFormScreen() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  // Leitura offline-first: cache na hora, revalida em background.
  const { data: equipData } = useEquipamentos(user?.prefeituraId);
  const { data: postosData } = usePostos(user?.prefeituraId);
  const { data: comboiosData } = useComboios(
    user?.prefeituraId,
    user?.funcionarioId,
  );
  const equipamentos = equipData ?? [];
  const postos = postosData ?? [];
  const comboios = comboiosData ?? [];

  const [comboioId, setComboioId] = useState("");
  const [equipment, setEquipment] = useState("");
  const [liters, setLiters] = useState("");
  const [measurement, setMeasurement] = useState<MeasurementType>("horimetro");
  const [reading, setReading] = useState("");
  const [postoId, setPostoId] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [gpsMsg, setGpsMsg] = useState("Capturando GPS…");

  const [isSaving, setIsSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const readingUnit = measurement === "horimetro" ? "h" : "km";

  // Saldo conhecido do comboio selecionado (cache) — para o aviso antecipado.
  const comboioSel = comboios.find((c) => c.id === comboioId);
  const saldoCache = comboioSel?.tank.currentVolume ?? null;
  const litrosNum = Number(liters);
  const semSaldo =
    !postoId &&
    saldoCache !== null &&
    litrosNum > 0 &&
    litrosNum > saldoCache;

  useEffect(() => {
    const u = getSessionUser();
    if (!u?.prefeituraId || !u.funcionarioId) {
      router.push("/");
      return;
    }
    queueMicrotask(() => setUser(u));

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      queueMicrotask(() => setGpsMsg("GPS indisponível neste dispositivo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsMsg("");
      },
      () => setGpsMsg("GPS indisponível — abastecimento salvo sem localização"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [router]);

  // Seleciona o comboio assim que a lista (cache ou rede) chega.
  useEffect(() => {
    if (!comboiosData) return;
    queueMicrotask(() =>
      setComboioId((atual) => {
        if (atual && comboiosData.some((c) => c.id === atual)) return atual;
        const salvo = getComboioSelecionado();
        return (
          (salvo && comboiosData.some((c) => c.id === salvo) && salvo) ||
          comboiosData[0]?.id ||
          ""
        );
      }),
    );
  }, [comboiosData]);

  function trocarComboio(id: string) {
    setComboioId(id);
    setComboioSelecionado(id);
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
    if (!(litrosNum > 0)) {
      setErro("Informe os litros abastecidos.");
      return;
    }
    if (!Number.isFinite(leituraNum)) {
      setErro("Informe a leitura atual.");
      return;
    }

    const user = getSessionUser();
    const pid = user?.prefeituraId ?? "";
    if (!pid) {
      setErro("Sessão expirada. Faça login novamente.");
      return;
    }
    // Sem posto, o combustível sai do comboio: precisa saber qual.
    if (!postoId && !comboioId) {
      setErro("Selecione o comboio de onde sai o combustível.");
      return;
    }

    setIsSaving(true);
    try {
      const meterPhoto = photoFile ? await fileToDataUrl(photoFile) : undefined;
      const { synced } = await submit("abastecimento", {
        prefeituraId: pid,
        comboioId: comboioId || undefined,
        funcionarioId: user?.funcionarioId,
        plateOrChassis: equipment.trim().toUpperCase(),
        liters: litrosNum,
        measurementType: measurement,
        currentReading: leituraNum,
        meterPhoto,
        postoId: postoId || undefined,
        latitude: coords?.lat ?? 0,
        longitude: coords?.lng ?? 0,
      });
      // Volta pro início: o dashboard mostra o tanque atualizado e o lançamento.
      setFlash(
        synced
          ? "Abastecimento registrado"
          : "Salvo no aparelho — sincroniza sozinho",
      );
      router.replace("/dashboard");
      return;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setErro("Equipamento não encontrado. Confira a placa ou o chassi.");
      } else {
        setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <FieldHeader />

      <PageBackHeader eyebrow="Lançamento" title="Abastecer" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <FormFieldLabel htmlFor="comboio" required>
            Comboio (origem do combustível)
          </FormFieldLabel>
          <ComboioSelect
            id="comboio"
            comboios={comboios}
            value={comboioId}
            onChange={trocarComboio}
            disabled={comboios.length === 0}
            placeholder={
              comboios.length
                ? "Selecione o comboio"
                : "Nenhum comboio disponível"
            }
          />
        </div>

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
          <p className="text-xs leading-relaxed text-muted-foreground">
            {equipamentos.length > 0
              ? `${equipamentos.length} equipamento(s) no cadastro — comece a digitar.`
              : "Digite a placa ou chassi do equipamento."}
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
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            required
          />
          {semSaldo ? (
            <p className="flex items-start gap-1.5 text-xs text-amber-500">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Acima do saldo do comboio ({saldoCache?.toLocaleString("pt-BR")} L).
              O lançamento pode ser recusado.
            </p>
          ) : null}
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
          <FormFieldLabel htmlFor="posto">Posto (opcional)</FormFieldLabel>
          <Select
            value={postoId}
            onValueChange={(v) => setPostoId(v === "comboio" ? "" : v)}
          >
            <SelectTrigger id="posto" className="h-11 w-full">
              <SelectValue placeholder="Comboio / não informado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comboio">Comboio / não informado</SelectItem>
              {postos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.cidadeUf ? ` · ${p.cidadeUf}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <FormFieldLabel>Foto do medidor (opcional)</FormFieldLabel>
          <PhotoUpload onSelect={setPhotoFile} />
          {photoFile ? (
            <p className="text-xs text-muted-foreground">
              Foto anexada: {photoFile.name}
            </p>
          ) : null}
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
            {isSaving ? "Salvando…" : "Salvar abastecimento"}
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
