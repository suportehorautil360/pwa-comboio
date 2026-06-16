"use client";

import { useCallback, useEffect, useState } from "react";

import { cacheEntry, cachePut, isStale } from "./cache";

export interface CachedResult<T> {
  data: T | undefined;
  /** true até ter algum dado (cache ou rede) na 1ª carga. */
  loading: boolean;
  /** o dado atual veio do cache (a rede ainda não respondeu/está offline). */
  fromCache: boolean;
  refetch: () => void;
}

/**
 * Read-through / stale-while-revalidate: entrega o cache na hora e revalida a
 * rede em background, atualizando cache + estado. Offline ou erro de rede mantêm
 * o último valor conhecido (nunca apaga). `key=null` desabilita a consulta (ex.:
 * faltam parâmetros). `ttl` evita revalidar um cache ainda fresco (default 0 =
 * sempre revalida quando online).
 */
export function useCached<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts?: { ttl?: number },
): CachedResult<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!key) {
      setLoading(false);
      return;
    }
    let ativo = true;
    setLoading(true);
    const online = typeof navigator === "undefined" || navigator.onLine;

    void cacheEntry<T>(key).then((entry) => {
      if (!ativo) return;
      if (entry) {
        setData(entry.data);
        setFromCache(true);
        setLoading(false);
      }
      const stale = !entry || isStale(entry.cachedAt, opts?.ttl ?? 0);
      if (!online || !stale) {
        setLoading(false);
        return;
      }
      void fetcher()
        .then((fresh) => {
          if (!ativo) return;
          setData(fresh);
          setFromCache(false);
          setLoading(false);
          void cachePut(key, fresh);
        })
        .catch(() => {
          if (ativo) setLoading(false); // offline/erro: fica com o cache
        });
    });

    return () => {
      ativo = false;
    };
    // `fetcher` é recriado a cada render; `key` (+ refetch) resume as dependências.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  return { data, loading, fromCache, refetch };
}
