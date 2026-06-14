"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/auth";
import {
  atualizarStatus,
  type DsarStatus,
} from "@/lib/dsar";

/**
 * Server Action: muda status de um pedido DSAR.
 * Restrito a sst|admin via exigirSessao.
 *
 * Onda 3 · escopo cross-tenant: SST passa `escopoEmpresaId = sessao.empresa_id`
 * para que `lib/dsar.atualizarStatus` filtre o UPDATE; admin omite o escopo
 * (pode triar pedidos sem empresa). Sem isso, um SST descobrindo o UUID de
 * outro tenant na URL conseguiria mutar pedido alheio.
 */
export async function transicaoDsar(formData: FormData): Promise<void> {
  const sessao = exigirSessao(["sst", "admin"]);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as DsarStatus;
  const resposta = String(formData.get("resposta") ?? "").trim() || null;

  if (!id || !["recebido", "em_analise", "atendido", "rejeitado"].includes(status)) {
    return;
  }

  const ehSst = sessao.papel === "sst";

  const resultado = await atualizarStatus({
    id,
    status,
    resposta,
    atendidoPor: sessao.email,
    // SST classificando: associa o pedido (caso ainda null) à empresa dele.
    empresaId: ehSst ? sessao.empresa_id : undefined,
    // Escopo: SST só muta linha da própria empresa (ou ainda sem empresa);
    // admin pode triar tudo.
    escopoEmpresaId: ehSst ? sessao.empresa_id : undefined,
  });

  if (!resultado.ok) {
    // Menor surpresa: log de aviso (audit-access já capturou a tentativa) e
    // revalida silenciosamente — a página recarrega e o pedido continua
    // intocado, mostrando ao operador que nada mudou.
    console.warn(
      "[dsar/actions] transicao bloqueada",
      `motivo=${resultado.motivo}`,
      `papel=${sessao.papel}`,
      `email=${sessao.email}`,
      `id=${id}`,
    );
  }

  revalidatePath("/juridico/dsar");
}
