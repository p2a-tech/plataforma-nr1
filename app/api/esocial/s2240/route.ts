import { NextRequest, NextResponse } from "next/server";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";
import { gerarS2240, gerarS2240PorTrabalhador } from "@/lib/esocial-s2240";

/**
 * GET /api/esocial/s2240?periodo=YYYY-MM&modo=agregado|por_cpf
 *
 * Gera o XML do evento eSocial S-2240 (agentes nocivos · camada psicossocial)
 * para o período informado. Retorna application/xml com Content-Disposition
 * de download.
 *
 *   - modo=agregado (default): um <evtExpRisco> por setor (representação interna).
 *   - modo=por_cpf: fan-out REAL — um <evtExpRisco> por colaborador ATIVO, com
 *     o perfil de risco do SETOR do trabalhador. Se não houver colaboradores
 *     cadastrados, ENCADEIA automaticamente no modo agregado.
 *
 * Auth: sst|admin (rota sensível — escrita pública seria perigosa).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function periodoValido(p: string | null): string {
  // Aceita YYYY-MM; default = mês corrente.
  if (p && /^\d{4}-\d{2}$/.test(p)) return p;
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

type Modo = "agregado" | "por_cpf";
function modoValido(m: string | null): Modo {
  return m === "por_cpf" ? "por_cpf" : "agregado";
}

export async function GET(req: NextRequest) {
  const sessao = exigirSessao(["sst", "admin"]);
  const url = new URL(req.url);
  const periodo = periodoValido(url.searchParams.get("periodo"));
  const modo = modoValido(url.searchParams.get("modo"));

  try {
    const { xml, sufixo } = await withEmpresa(sessao.empresa_id, async () => {
      if (modo === "por_cpf") {
        const r = await gerarS2240PorTrabalhador(sessao.empresa_id, periodo);
        // Sem colaboradores cadastrados → encadeia no agregado (fallback).
        if (r.semColaboradores) {
          const ag = await gerarS2240(sessao.empresa_id, periodo);
          return { xml: ag.xml, sufixo: "agregado" };
        }
        return { xml: r.xml, sufixo: "por-cpf" };
      }
      const ag = await gerarS2240(sessao.empresa_id, periodo);
      return { xml: ag.xml, sufixo: "agregado" };
    });

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="S-2240-${sufixo}-${periodo}.xml"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/esocial/s2240] erro:", err);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
