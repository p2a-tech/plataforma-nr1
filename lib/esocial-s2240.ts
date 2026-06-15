import "server-only";
import { sql } from "@/lib/db";
import { getInventarioRiscos } from "@/lib/queries";
import { listarColaboradores } from "@/lib/colaboradores";
import type { Risco } from "@/lib/mock-data";

/**
 * Gerador do evento eSocial S-2240 (Condições Ambientais do Trabalho —
 * Agentes Nocivos) com a camada psicossocial introduzida pela NR-1/2024.
 *
 * Layout: leiautes do eSocial v.S-1.3 (2025), namespace
 *   `http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_03_00`
 *
 * IMPORTANTE: este XML é uma **representação agregada por setor** dos riscos
 * psicossociais detectados pela PrevIA. O eSocial real exige um evento por
 * vínculo (CPF) exposto a cada agente nocivo, e essa expansão para CPF acontece
 * na integração com a folha (DP) — fora do escopo desta etapa do produto.
 *
 * O arquivo gerado serve para:
 *   1) auditoria e revisão pelo SST antes da transmissão real;
 *   2) integração com o middleware contábil (que faz fan-out por CPF);
 *   3) evidência documental da etapa "Compliance" da cadeia de evidências
 *      (defesa em juízo trabalhista).
 *
 * Códigos `codAgNoc`: tabela 23 do eSocial usa "9999" para "Outros agentes
 * nocivos / fatores de risco" — onde a camada psicossocial é alocada hoje,
 * com a descrição (`dscAgNoc`) detalhando o ofensor específico.
 */

interface DadosEmpresa {
  id: string;
  nome: string;
  cnpj: string | null;
}

async function getDadosEmpresa(empresaId: string): Promise<DadosEmpresa> {
  const [row] = await sql<{ id: string; nome: string; cnpj: string | null }[]>`
    select id, nome, cnpj from public.empresas where id = ${empresaId} limit 1
  `;
  return row ?? { id: empresaId, nome: "(empresa)", cnpj: null };
}

/** Escape XML mínimo — suficiente para texto interno de elemento/atributo. */
function escXml(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Apenas dígitos do CNPJ — eSocial valida formato. */
function soDigitos(s: string | null): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * Calcula período `dtIniCondicao` / `dtFimCondicao` a partir de `YYYY-MM`.
 * Retorna no formato ISO `YYYY-MM-DD` exigido pelo schema.
 */
function periodoDatas(periodo: string): { ini: string; fim: string } {
  // Fail-safe: aceita YYYY-MM ou YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})/.exec(periodo);
  if (!m) {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const mo = String(hoje.getMonth() + 1).padStart(2, "0");
    return { ini: `${y}-${mo}-01`, fim: `${y}-${mo}-28` };
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const ini = `${y}-${String(mo).padStart(2, "0")}-01`;
  const ultimoDia = new Date(y, mo, 0).getDate();
  const fim = `${y}-${String(mo).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { ini, fim };
}

/**
 * Intensidade/Concentração — eSocial usa o campo `intConc` (texto livre, até
 * 999 caracteres). Aqui transformamos severidade × probabilidade em rótulo.
 */
function intensidadeLabel(sev: number, prob: number): string {
  const nivel = sev * prob;
  if (nivel >= 15) return "Crítico — exposição persistente e impacto grave";
  if (nivel >= 9) return "Alto — exposição frequente, requer plano imediato";
  if (nivel >= 4) return "Médio — exposição intermitente, monitorar";
  return "Baixo — exposição esporádica";
}

/**
 * Gera o XML do evento. Não transmite — apenas serializa.
 * Deve ser chamado DENTRO de withEmpresa(empresaId, ...).
 */
export async function gerarS2240(
  empresaId: string,
  periodo: string,
): Promise<{ xml: string; quantRiscos: number; periodo: { ini: string; fim: string } }> {
  const [empresa, inv] = await Promise.all([
    getDadosEmpresa(empresaId),
    getInventarioRiscos(),
  ]);

  const { ini, fim } = periodoDatas(periodo);
  const cnpj = soDigitos(empresa.cnpj);
  const idEvento = `ID${cnpj.padStart(14, "0")}${ini.replace(/-/g, "")}${String(
    Math.floor(Math.random() * 1_000_000_000),
  ).padStart(9, "0")}`;
  const gerado = new Date().toISOString();

  // Agrupa riscos por setor → vira uma <infoExpRisco> por setor.
  const porSetor = new Map<string, typeof inv.riscos>();
  for (const r of inv.riscos) {
    const k = r.setor || "(sem-setor)";
    const arr = porSetor.get(k) ?? [];
    arr.push(r);
    porSetor.set(k, arr);
  }

  const blocosInfoExpRisco = Array.from(porSetor.entries())
    .map(([setor, riscos]) => {
      const agentes = blocosAgNoc(riscos);
      return `
    <infoExpRisco>
      <infoAmb>
        <localAmb>1</localAmb>
        <dscSetor>${escXml(setor)}</dscSetor>
      </infoAmb>
      <infoAtiv>
        <dscAtivDes>${escXml(
          "Atividades cotidianas do setor com exposição a fatores psicossociais identificados pelo radar PrevIA (escuta ativa + clínica parceira).",
        )}</dscAtivDes>
      </infoAtiv>${agentes}
    </infoExpRisco>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  PrevIA · evento eSocial S-2240 (exposição a agentes nocivos — camada psicossocial).
  ATENÇÃO: representação AGREGADA por setor. O eSocial de produção exige um evento
  por trabalhador (CPF). A expansão por CPF ocorre na integração com a folha (DP)
  via middleware contábil. Este arquivo é evidência interna + base para transmissão.
  Empresa: ${escXml(empresa.nome)} (id=${escXml(empresa.id)}) · CNPJ ${escXml(empresa.cnpj ?? "(sem)")}
  Período: ${ini} → ${fim} · Riscos agregados: ${inv.riscos.length}
  Gerado em: ${gerado}
-->
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_03_00">
  <evtExpRisco Id="${escXml(idEvento)}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>PrevIA-1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${escXml(cnpj.slice(0, 8))}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>00000000000</cpfTrab>
      <matricula>AGREGADO-${escXml(empresa.id)}</matricula>
    </ideVinculo>
    <infoExpRiscoAg>
      <dtIniCondicao>${ini}</dtIniCondicao>
      <dtFimCondicao>${fim}</dtFimCondicao>${blocosInfoExpRisco}
    </infoExpRiscoAg>
  </evtExpRisco>
</eSocial>
`;

  return { xml, quantRiscos: inv.riscos.length, periodo: { ini, fim } };
}

/* -------------------------------------------------------------------------- */
/*  S-2240 POR TRABALHADOR (CPF) — fan-out real do perfil de risco do setor   */
/* -------------------------------------------------------------------------- */

/**
 * Constrói os blocos <agNoc> de um setor a partir dos riscos do inventário DRPS.
 * Reaproveitado pelo modo agregado e pelo modo por-CPF (mesma metodologia).
 */
function blocosAgNoc(riscos: Risco[]): string {
  return riscos
    .map(
      (r) => `
        <agNoc>
          <codAgNoc>09.01.001</codAgNoc>
          <dscAgNoc>${escXml(`Fator psicossocial — ${r.fonte}. Ação prevista: ${r.acao} (resp.: ${r.responsavel})`)}</dscAgNoc>
          <tpAval>2</tpAval>
          <intConc>${escXml(intensidadeLabel(r.severidade, r.probabilidade))}</intConc>
          <utilizEPC>1</utilizEPC>
          <utilizEPI>1</utilizEPI>
        </agNoc>`,
    )
    .join("");
}

export interface S2240PorTrabalhadorResultado {
  /** XML com 1 evtExpRisco por colaborador ativo (vazio se modo encadeado). */
  xml: string;
  /** Quantidade de eventos evtExpRisco emitidos (= colaboradores ativos). */
  quantEventos: number;
  /** Quantos colaboradores ficaram sem perfil de risco (setor sem riscos). */
  semPerfil: number;
  periodo: { ini: string; fim: string };
  /**
   * Quando não há colaboradores cadastrados, sinaliza que o caller deve cair
   * no modo agregado. `xml` vem vazio nesse caso.
   */
  semColaboradores: boolean;
}

/**
 * Gera o XML do S-2240 com fan-out REAL por CPF: para cada colaborador ATIVO,
 * emite um <evtExpRisco> cujos <agNoc> derivam do perfil de risco do SETOR do
 * colaborador (inventário DRPS / matriz por setor — getInventarioRiscos).
 *
 * METODOLOGIA (comentada no header do XML): a PrevIA é anônima no DRPS; o risco
 * é mapeado por SETOR e APLICADO ao trabalhador via o quadro de RH (CPF, setor)
 * cadastrado pela empresa. Isso NÃO liga o CPF a respostas individuais — a
 * barreira de anonimato/k-anonimato permanece intacta.
 *
 * Se NÃO houver colaboradores cadastrados, retorna `semColaboradores: true`
 * (xml vazio) para o caller encadear no modo agregado (gerarS2240).
 *
 * Deve ser chamado DENTRO de withEmpresa(empresaId, ...).
 */
export async function gerarS2240PorTrabalhador(
  empresaId: string,
  periodo: string,
): Promise<S2240PorTrabalhadorResultado> {
  const { ini, fim } = periodoDatas(periodo);

  const [empresa, inv, colaboradores] = await Promise.all([
    getDadosEmpresa(empresaId),
    getInventarioRiscos(),
    // CPF CRU: este é o ÚNICO ponto autorizado a ler o CPF sem máscara, pois o
    // eSocial exige o CPF real do trabalhador no <cpfTrab>.
    listarColaboradores(empresaId, { apenasAtivos: true, cpfCru: true }),
  ]);

  if (colaboradores.length === 0) {
    return {
      xml: "",
      quantEventos: 0,
      semPerfil: 0,
      periodo: { ini, fim },
      semColaboradores: true,
    };
  }

  // Perfil de risco por setor (chave de mapeamento setor → riscos).
  const riscosPorSetor = new Map<string, Risco[]>();
  for (const r of inv.riscos) {
    const k = r.setor || "(sem-setor)";
    const arr = riscosPorSetor.get(k) ?? [];
    arr.push(r);
    riscosPorSetor.set(k, arr);
  }

  const cnpj = soDigitos(empresa.cnpj);
  const nrInsc = cnpj.slice(0, 8);
  let semPerfil = 0;

  const eventos = colaboradores
    .map((c, idx) => {
      const cpf = soDigitos(c.cpf).padStart(11, "0");
      const riscos = riscosPorSetor.get(c.setor) ?? [];
      if (riscos.length === 0) semPerfil++;

      const idEvento = `ID${cnpj.padStart(14, "0")}${ini.replace(/-/g, "")}${String(
        idx + 1,
      ).padStart(9, "0")}`;
      const matricula = c.matricula
        ? escXml(c.matricula)
        : `CPF-${cpf}`;

      const agentes =
        riscos.length > 0
          ? blocosAgNoc(riscos)
          : `
        <!-- Setor "${escXml(c.setor)}" sem riscos psicossociais no inventário DRPS no período. -->`;

      return `
  <evtExpRisco Id="${escXml(idEvento)}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>PrevIA-1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${escXml(nrInsc)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${escXml(cpf)}</cpfTrab>
      <matricula>${matricula}</matricula>
    </ideVinculo>
    <infoExpRiscoAg>
      <dtIniCondicao>${ini}</dtIniCondicao>
      <dtFimCondicao>${fim}</dtFimCondicao>
      <infoExpRisco>
        <infoAmb>
          <localAmb>1</localAmb>
          <dscSetor>${escXml(c.setor)}</dscSetor>
        </infoAmb>
        <infoAtiv>
          <dscAtivDes>${escXml(
            "Atividades cotidianas do setor com exposição a fatores psicossociais identificados pelo radar PrevIA (escuta ativa + clínica parceira).",
          )}</dscAtivDes>
        </infoAtiv>${agentes}
      </infoExpRisco>
    </infoExpRiscoAg>
  </evtExpRisco>`;
    })
    .join("");

  const gerado = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  PrevIA · eventos eSocial S-2240 (exposição a agentes nocivos — camada psicossocial).
  MODO POR TRABALHADOR (CPF): um <evtExpRisco> por colaborador ATIVO do quadro de RH.

  METODOLOGIA: a PrevIA é ANÔNIMA no DRPS. O perfil de risco é apurado POR SETOR
  (inventário DRPS / matriz de risco por setor) e APLICADO a cada trabalhador via
  o setor declarado no quadro de RH (tabela colaborador_registro, separada das
  respostas anônimas). O CPF NÃO é cruzado com respostas individuais — a barreira
  de anonimato/k-anonimato permanece intacta. O CPF é PII do empregador, que é o
  responsável legal por declará-lo no eSocial.

  Empresa: ${escXml(empresa.nome)} (id=${escXml(empresa.id)}) · CNPJ ${escXml(empresa.cnpj ?? "(sem)")}
  Período: ${ini} → ${fim}
  Colaboradores ativos: ${colaboradores.length} · Eventos emitidos: ${colaboradores.length}
  Sem perfil de risco no setor: ${semPerfil}
  Gerado em: ${gerado}
-->
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_03_00">${eventos}
</eSocial>
`;

  return {
    xml,
    quantEventos: colaboradores.length,
    semPerfil,
    periodo: { ini, fim },
    semColaboradores: false,
  };
}
