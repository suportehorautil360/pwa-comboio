/**
 * Feature flags por prefeitura (módulo feature-flags do back-360-).
 * Opt-in: ausência da flag = desativada. Guarda o último valor conhecido em
 * localStorage para o gate continuar funcionando offline.
 */
import { api } from "./client";

export type FeatureFlags = Record<string, boolean>;

function cacheKey(prefeituraId: string): string {
  return `hu360-ff:${prefeituraId}`;
}

function lerCache(prefeituraId: string): FeatureFlags {
  try {
    const raw = localStorage.getItem(cacheKey(prefeituraId));
    return raw ? (JSON.parse(raw) as FeatureFlags) : {};
  } catch {
    return {};
  }
}

function gravarCache(prefeituraId: string, flags: FeatureFlags): void {
  try {
    localStorage.setItem(cacheKey(prefeituraId), JSON.stringify(flags));
  } catch {
    /* storage indisponível — ignora */
  }
}

export const featureFlagsApi = {
  /** Busca as flags; offline/erro cai no último valor cacheado. */
  async obter(prefeituraId: string): Promise<FeatureFlags> {
    try {
      const r = await api.get<{ data: FeatureFlags }>(
        `/feature-flags/${prefeituraId}`,
      );
      const flags = r.data ?? {};
      gravarCache(prefeituraId, flags);
      return flags;
    } catch {
      return lerCache(prefeituraId);
    }
  },

  /** Registro de ponto ativo para a prefeitura. */
  async pontoAtivo(prefeituraId: string): Promise<boolean> {
    if (!prefeituraId) return false;
    const flags = await this.obter(prefeituraId);
    return flags.ponto === true;
  },
};
