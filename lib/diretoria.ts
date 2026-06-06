import "server-only";
import { sqlAdmin as sql, dbHabilitado } from "@/lib/db";
import { energiaParaRisco } from "@/lib/radar";

/**
 * Visão Diretoria (grupo) — consolida TODAS as empresas operacionais.
 * Cross-tenant: usa `sqlAdmin` (sem escopo de RLS) para agregar por empresa.
 * Não cruza a barreira de sigilo: só lê agregados anônimos (pulso_respostas).
 */

// Empresas que NÃO aparecem na visão do grupo (pseudo/holding/piloto avulso).
const EXCLUIR = ["emp_unscoped", "emp_grupo_gps", "emp_translog"];

export type NivelRisco = "baixo" | "moderado" | "alto" | "critico";

export interface EmpresaResumo {
  id: string;
  nome: string;
  segmento: string;
  colaboradores: number;
  respostas: number;
  adesao: number; // %
  risco: number; // 0-100
  nivel: NivelRisco;
}

export interface DiretoriaOverview {
  fonte: "db" | "vazio";
  empresas: EmpresaResumo[];
  segmentos: string[];
  global: {
    totalEmpresas: number;
    totalColaboradores: number;
    totalRespostas: number;
    adesaoMedia: number;
    riscoMedio: number;
    porNivel: Record<NivelRisco, number>;
  };
}

function nivelDeRisco(r: number): NivelRisco {
  if (r >= 75) return "critico";
  if (r >= 55) return "alto";
  if (r >= 35) return "moderado";
  return "baixo";
}

const VAZIO: DiretoriaOverview = {
  fonte: "vazio",
  empresas: [],
  segmentos: [],
  global: {
    totalEmpresas: 0,
    totalColaboradores: 0,
    totalRespostas: 0,
    adesaoMedia: 0,
    riscoMedio: 0,
    porNivel: { baixo: 0, moderado: 0, alto: 0, critico: 0 },
  },
};

export async function getDiretoriaOverview(): Promise<DiretoriaOverview> {
  if (!dbHabilitado) return VAZIO;

  const rows = await sql<
    { id: string; nome: string; segmento: string | null; colaboradores: number; respostas: number; avg_en: number | null }[]
  >`
    select e.id, e.nome, e.segmento,
           coalesce(e.colaboradores, 0)::int as colaboradores,
           count(p.id)::int as respostas,
           avg(p.energia)::float8 as avg_en
    from public.empresas e
    left join public.pulso_respostas p on p.empresa_id = e.id
    where e.id <> all(${EXCLUIR})
    group by e.id, e.nome, e.segmento, e.colaboradores
    order by e.colaboradores desc nulls last, e.nome
  `;

  const empresas: EmpresaResumo[] = rows.map((r) => {
    const risco = r.respostas > 0 && r.avg_en != null ? energiaParaRisco(r.avg_en) : 0;
    const adesao = r.colaboradores > 0 ? Math.min(100, Math.round((r.respostas / r.colaboradores) * 100)) : 0;
    return {
      id: r.id,
      nome: r.nome,
      segmento: r.segmento ?? "Sem segmento",
      colaboradores: r.colaboradores,
      respostas: r.respostas,
      adesao,
      risco,
      nivel: nivelDeRisco(risco),
    };
  });

  const porNivel: Record<NivelRisco, number> = { baixo: 0, moderado: 0, alto: 0, critico: 0 };
  let somaColab = 0;
  let somaResp = 0;
  let somaRiscoPond = 0;
  for (const e of empresas) {
    porNivel[e.nivel]++;
    somaColab += e.colaboradores;
    somaResp += e.respostas;
    somaRiscoPond += e.risco * e.respostas;
  }

  const segmentos = Array.from(new Set(empresas.map((e) => e.segmento))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    fonte: "db",
    empresas,
    segmentos,
    global: {
      totalEmpresas: empresas.length,
      totalColaboradores: somaColab,
      totalRespostas: somaResp,
      adesaoMedia: somaColab > 0 ? Math.min(100, Math.round((somaResp / somaColab) * 100)) : 0,
      riscoMedio: somaResp > 0 ? Math.round(somaRiscoPond / somaResp) : 0,
      porNivel,
    },
  };
}
