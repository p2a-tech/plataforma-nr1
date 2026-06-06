import "server-only";
import { K_MIN } from "@previa/contracts";
import { sqlAdmin as sql, dbHabilitado } from "@/lib/db";
import { energiaParaRisco } from "@/lib/radar";

/**
 * Visão Diretoria (consolidado/global): empresas do grupo em risco ALTO e os
 * setores mais críticos de cada uma. Cross-tenant (sqlAdmin), só agregados.
 */
const NAO_GRUPO = ["emp_unscoped", "emp_grupo_gps", "emp_translog"];
const LIMIAR_ALTO = 55; // nível "alto" (>=55) ou "crítico" (>=75)

export interface SetorRisco {
  setor: string;
  risco: number;
}
export interface EmpresaRiscoAlto {
  id: string;
  nome: string;
  segmento: string;
  risco: number;
  critico: boolean;
  setores: SetorRisco[];
}

export async function getEmpresasRiscoAlto(): Promise<EmpresaRiscoAlto[]> {
  if (!dbHabilitado) return [];

  const emp = await sql<{ id: string; nome: string; segmento: string | null; avg_en: number | null }[]>`
    select e.id, e.nome, e.segmento, avg(p.energia)::float8 as avg_en
    from public.empresas e
    join public.pulso_respostas p on p.empresa_id = e.id
    where e.id <> all(${NAO_GRUPO})
    group by e.id, e.nome, e.segmento
  `;

  const altas = emp
    .map((r) => ({
      id: r.id,
      nome: r.nome,
      segmento: r.segmento ?? "—",
      risco: r.avg_en != null ? energiaParaRisco(r.avg_en) : 0,
    }))
    .filter((r) => r.risco >= LIMIAR_ALTO)
    .sort((a, b) => b.risco - a.risco);

  if (altas.length === 0) return [];

  const ids = altas.map((a) => a.id);
  const setores = await sql<{ empresa_id: string; setor: string; avg_en: number }[]>`
    select empresa_id, cluster_setor as setor, avg(energia)::float8 as avg_en
    from public.pulso_respostas
    where empresa_id = ANY(${ids})
    group by empresa_id, cluster_setor
    having count(*) >= ${K_MIN}
  `;

  const porEmp = new Map<string, SetorRisco[]>();
  for (const s of setores) {
    const arr = porEmp.get(s.empresa_id) ?? [];
    arr.push({ setor: s.setor, risco: energiaParaRisco(s.avg_en) });
    porEmp.set(s.empresa_id, arr);
  }

  return altas.map((a) => ({
    ...a,
    critico: a.risco >= 75,
    setores: (porEmp.get(a.id) ?? [])
      .filter((s) => s.risco >= LIMIAR_ALTO)
      .sort((x, y) => y.risco - x.risco)
      .slice(0, 4),
  }));
}
