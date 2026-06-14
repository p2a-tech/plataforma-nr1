import "server-only";
import { sqlAdmin } from "@/lib/db";

/**
 * Catálogo de papéis profissionais (Onda 5 · Dev A · §11).
 *
 * Catálogo GLOBAL (sem tenant) — alimenta o autocomplete da Q2 do DRPS e
 * qualquer outro form que precise normalizar o cargo do colaborador. Sem RLS
 * na tabela (vide migration 0017), então usamos `sqlAdmin` direto.
 *
 * Empresa pode declarar cargos próprios via texto livre ("Outro") na Q2 —
 * uma futura iteração (P2) pode persistir esses cargos custom numa tabela
 * `cargo_empresa` ou em campo `meta jsonb`.
 */

export type AreaCargo =
  | "clinica"
  | "administrativa"
  | "operacional"
  | "comercial"
  | "apoio"
  | "direcao";

export interface CargoClinico {
  id: string;
  nome: string;
  conselho_profissional: string | null;
  area: AreaCargo;
}

/** Lista TODOS os cargos do catálogo (ordenados por área e nome). */
export async function listarCargos(): Promise<CargoClinico[]> {
  return sqlAdmin<CargoClinico[]>`
    select id, nome, conselho_profissional, area
      from public.cargo_clinico
     order by area, nome
  `;
}

/** Filtra por área funcional. */
export async function porArea(area: AreaCargo): Promise<CargoClinico[]> {
  return sqlAdmin<CargoClinico[]>`
    select id, nome, conselho_profissional, area
      from public.cargo_clinico
     where area = ${area}
     order by nome
  `;
}

/**
 * Busca cargos cujo `nome` contém a query (case-insensitive). Vazio retorna a
 * lista completa. Limita a 12 resultados — suficiente pra autocomplete.
 */
export async function matchPorTexto(
  query: string,
  limit: number = 12,
): Promise<CargoClinico[]> {
  const q = (query ?? "").trim();
  const lim = Math.min(Math.max(limit, 1), 50);
  if (!q) {
    return sqlAdmin<CargoClinico[]>`
      select id, nome, conselho_profissional, area
        from public.cargo_clinico
       order by nome
       limit ${lim}
    `;
  }
  // ILIKE %q% — case-insensitive; postgres.js escapa o literal automaticamente
  // (sql template tag). Prefixo + sufixo wildcard para "psico" casar com
  // "Psicologia", "Psicopedagogia" etc.
  return sqlAdmin<CargoClinico[]>`
    select id, nome, conselho_profissional, area
      from public.cargo_clinico
     where nome ilike ${"%" + q + "%"}
     order by
       -- prioriza matches que começam com a query
       case when nome ilike ${q + "%"} then 0 else 1 end,
       nome
     limit ${lim}
  `;
}
