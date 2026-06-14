import { NextRequest, NextResponse } from "next/server";
import { exigirSessao } from "@/lib/auth";
import { withEmpresa } from "@/lib/tenant";
import { gerarS2240 } from "@/lib/esocial-s2240";

/**
 * GET /api/esocial/s2240?periodo=YYYY-MM
 *
 * Gera o XML do evento eSocial S-2240 (agentes nocivos · camada psicossocial)
 * para o período informado. Retorna application/xml com Content-Disposition
 * de download.
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

export async function GET(req: NextRequest) {
  const sessao = exigirSessao(["sst", "admin"]);
  const url = new URL(req.url);
  const periodo = periodoValido(url.searchParams.get("periodo"));

  try {
    const { xml } = await withEmpresa(sessao.empresa_id, () =>
      gerarS2240(sessao.empresa_id, periodo),
    );

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="S-2240-${periodo}.xml"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/esocial/s2240] erro:", err);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
