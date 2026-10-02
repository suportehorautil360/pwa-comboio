/**
 * A batida que acabou de subir entra na folha guardada no aparelho.
 *
 * Sem isto havia um buraco: a batida saía da fila (deixava de aparecer como
 * "Pendente de envio") e a folha em cache ainda não a tinha — a linha voltava
 * a "Sem registro" até a próxima leitura do servidor, com o botão Bater à
 * mostra. Bater de novo ali é uma segunda batida no ledger.
 */
import type { PontoRegistro } from "../api/ponto";
import { cachePatch } from "../data/cache";
import { cacheKeys, quemDaSessao } from "../data/cache-keys";
import { getSessionUser } from "../session";
import { limparCpf } from "./cpf";

/** `resposta` é o corpo do `POST /checklist/bater-ponto`: `{ data: batida }`. */
export async function guardarBatidaEnviada(resposta: unknown): Promise<void> {
  const d = (resposta as { data?: Partial<PontoRegistro> } | null)?.data;
  if (!d?.id || !d.timestampOriginal || !d.tipo) return;

  const user = getSessionUser();
  if (!user) return;

  // A fila é do aparelho, não da pessoa: a batida de quem usou antes pode
  // subir com outro login aberto. Só entra na folha de quem a bateu.
  const cpf = limparCpf(user.cpf ?? "");
  const daPessoa =
    cpf && d.cpf
      ? limparCpf(String(d.cpf)) === cpf
      : (d.name ?? "").trim().toLowerCase() === (user.nome ?? "").trim().toLowerCase();
  if (!daPessoa) return;

  const key = cacheKeys.ponto(user.prefeituraId, quemDaSessao(user));
  if (!key) return;

  // A selfie não vai para o cache: é grande e a folha não a mostra.
  const batida = { ...d, prefeituraId: user.prefeituraId } as PontoRegistro;
  delete batida.photo;

  await cachePatch<PontoRegistro[]>(key, (atual) => {
    const lista = atual ?? [];
    if (lista.some((r) => r.id === batida.id)) return undefined;
    return [...lista, batida];
  });
}
