/**
 * Consultas cacheadas (offline-first) usadas pelas telas. Cada hook envolve uma
 * função de `lib/api/*` com {@link useCached}: entrega o último valor conhecido
 * na hora e revalida a rede em background. As chaves são namespaced por recurso
 * + parâmetros, e o TTL evita revalidar caches ainda frescos.
 */
"use client";

import {
  listarEquipamentos,
  listarPostos,
  type EquipamentoApi,
  type PostoApi,
} from "../api/abastecimento";
import { abonosApi, type Abono } from "../api/abonos";
import {
  listarComboiosDoMotorista,
  type ComboioItem,
} from "../api/comboios";
import { configuracoesApi, type EmpresaConfig } from "../api/configuracoes";
import {
  getHistorico,
  getUltimosLancamentos,
  type HistoricoData,
  type LancamentoItem,
} from "../api/dashboard";
import { escalaApi, type Escala } from "../api/escala";
import { pontoApi, type PontoRegistro } from "../api/ponto";
import {
  solicitacoesPontoApi,
  type SolicitacaoPonto,
} from "../api/solicitacoes-ponto";
import { useCached, type CachedResult } from "./use-cached";

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/** Comboios em que o motorista é condutor (muda pouco no turno). */
export function useComboios(
  prefeituraId?: string,
  funcionarioId?: string,
): CachedResult<ComboioItem[]> {
  return useCached(
    prefeituraId && funcionarioId
      ? `comboios:${prefeituraId}:${funcionarioId}`
      : null,
    () => listarComboiosDoMotorista(prefeituraId!, funcionarioId!),
    { ttl: 5 * MIN },
  );
}

/** Equipamentos da prefeitura (autocomplete de placa/chassi). */
export function useEquipamentos(
  prefeituraId?: string,
): CachedResult<EquipamentoApi[]> {
  return useCached(
    prefeituraId ? `equipamentos:${prefeituraId}` : null,
    () => listarEquipamentos(prefeituraId!),
    { ttl: DIA },
  );
}

/** Postos da prefeitura. */
export function usePostos(prefeituraId?: string): CachedResult<PostoApi[]> {
  return useCached(
    prefeituraId ? `postos:${prefeituraId}` : null,
    () => listarPostos(prefeituraId!),
    { ttl: DIA },
  );
}

/** Últimos lançamentos (feed do dashboard). */
export function useUltimosLancamentos(
  prefeituraId?: string,
  limite = 6,
): CachedResult<LancamentoItem[]> {
  return useCached(
    prefeituraId ? `ultimos:${prefeituraId}:${limite}` : null,
    () => getUltimosLancamentos(prefeituraId!, limite),
    { ttl: 2 * MIN },
  );
}

/** Histórico completo (resumo do dia + grupos por data). */
export function useHistorico(
  prefeituraId?: string,
): CachedResult<HistoricoData> {
  return useCached(
    prefeituraId ? `historico:${prefeituraId}` : null,
    () => getHistorico(prefeituraId!),
    { ttl: 2 * MIN },
  );
}

/** Batidas de ponto da prefeitura (o front filtra pelo operador). */
export function useTimeRecords(
  prefeituraId?: string,
): CachedResult<PontoRegistro[]> {
  return useCached(
    prefeituraId ? `time-records:${prefeituraId}` : null,
    () => pontoApi.listar(prefeituraId!),
    { ttl: 2 * MIN },
  );
}

/** Escala (jornada) da prefeitura. */
export function useEscala(
  prefeituraId?: string,
): CachedResult<Escala | null> {
  return useCached(
    prefeituraId ? `escala:${prefeituraId}` : null,
    () => escalaApi.obter(prefeituraId!),
    { ttl: DIA },
  );
}

/** Abonos da prefeitura. */
export function useAbonos(prefeituraId?: string): CachedResult<Abono[]> {
  return useCached(
    prefeituraId ? `abonos:${prefeituraId}` : null,
    () => abonosApi.listar(prefeituraId!),
    { ttl: 5 * MIN },
  );
}

/** Dados da empresa (CRPT do comprovante de ponto). */
export function useEmpresa(
  prefeituraId?: string,
): CachedResult<EmpresaConfig | null> {
  return useCached(
    prefeituraId ? `empresa:${prefeituraId}` : null,
    () => configuracoesApi.obterEmpresa(prefeituraId!),
    { ttl: DIA },
  );
}

/** Solicitações de ajuste de ponto do operador. */
export function useSolicitacoes(
  prefeituraId?: string,
): CachedResult<SolicitacaoPonto[]> {
  return useCached(
    prefeituraId ? `solicitacoes:${prefeituraId}` : null,
    () => solicitacoesPontoApi.listar(prefeituraId!),
    { ttl: 5 * MIN },
  );
}
