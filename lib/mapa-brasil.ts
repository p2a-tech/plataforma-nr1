/**
 * Mapa do Brasil (estilizado) para a visão Diretoria.
 * Silhueta e cidades projetadas a partir de lon/lat com a MESMA transformação,
 * então os pontos caem corretos sobre o contorno. Cores do sistema no componente.
 */

export interface Cidade {
  id: string;
  nome: string;
  uf: string;
  lon: number;
  lat: number;
}
export interface LocalMapa {
  id: string;
  nome: string;
  uf: string;
  x: number;
  y: number;
  empresas: number;
}

export const VB = 600; // viewBox quadrado
const LON_MIN = -74,
  LON_MAX = -34,
  LAT_MIN = -34,
  LAT_MAX = 6,
  PAD = 26;

const px = (lon: number) => PAD + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (VB - 2 * PAD);
const py = (lat: number) => PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (VB - 2 * PAD);

// Contorno aproximado do Brasil (lon,lat), sentido horário a partir do norte.
const BORDER: [number, number][] = [
  [-60.2, 5.2], [-51.6, 4.1], [-50.0, 0.0], [-44.3, -2.5], [-38.5, -3.7],
  [-35.2, -5.8], [-34.8, -7.1], [-35.7, -9.6], [-37.0, -11.0], [-38.5, -13.0],
  [-39.7, -15.8], [-39.0, -18.5], [-40.3, -20.3], [-41.9, -22.4], [-43.2, -23.0],
  [-46.3, -24.0], [-48.5, -25.5], [-48.6, -28.5], [-50.5, -30.5], [-52.3, -31.8],
  [-53.4, -33.7], [-55.6, -31.0], [-57.6, -30.2], [-56.0, -27.4], [-54.6, -25.6],
  [-57.9, -22.1], [-58.2, -19.9], [-60.0, -16.3], [-58.4, -12.5], [-60.5, -10.5],
  [-65.3, -9.8], [-70.0, -11.0], [-73.0, -7.5], [-70.5, -4.0], [-69.4, -1.0],
  [-67.3, 2.0], [-64.0, 4.0],
];

export const OUTLINE =
  "M " + BORDER.map(([lo, la]) => `${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join(" L ") + " Z";

export const CIDADES: Cidade[] = [
  { id: "sp", nome: "São Paulo", uf: "SP", lon: -46.63, lat: -23.55 },
  { id: "rj", nome: "Rio de Janeiro", uf: "RJ", lon: -43.2, lat: -22.91 },
  { id: "bh", nome: "Belo Horizonte", uf: "MG", lon: -43.94, lat: -19.92 },
  { id: "bsb", nome: "Brasília", uf: "DF", lon: -47.93, lat: -15.78 },
  { id: "cwb", nome: "Curitiba", uf: "PR", lon: -49.27, lat: -25.43 },
  { id: "poa", nome: "Porto Alegre", uf: "RS", lon: -51.23, lat: -30.03 },
  { id: "ssa", nome: "Salvador", uf: "BA", lon: -38.51, lat: -12.97 },
  { id: "rec", nome: "Recife", uf: "PE", lon: -34.88, lat: -8.05 },
  { id: "for", nome: "Fortaleza", uf: "CE", lon: -38.54, lat: -3.73 },
  { id: "bel", nome: "Belém", uf: "PA", lon: -48.5, lat: -1.46 },
  { id: "mao", nome: "Manaus", uf: "AM", lon: -60.02, lat: -3.1 },
  { id: "gyn", nome: "Goiânia", uf: "GO", lon: -49.25, lat: -16.68 },
  { id: "fln", nome: "Florianópolis", uf: "SC", lon: -48.55, lat: -27.59 },
  { id: "vix", nome: "Vitória", uf: "ES", lon: -40.34, lat: -20.32 },
  { id: "cgb", nome: "Cuiabá", uf: "MT", lon: -56.1, lat: -15.6 },
  { id: "slz", nome: "São Luís", uf: "MA", lon: -44.3, lat: -2.53 },
];

// Praças atendidas por empresa (demo). Global = união de todas.
const EMPRESA_CIDADES: Record<string, string[]> = {
  emp_rudder: ["sp", "rj", "bh", "bsb", "cwb", "poa"],
  emp_inhaus: ["sp", "rj", "bh", "cwb", "ssa", "rec", "for"],
  emp_topservice: ["sp", "rj", "bsb", "gyn", "ssa", "bel"],
  emp_allis: ["sp", "rj", "cwb", "poa", "bh"],
  emp_conbras: ["sp", "rj", "bsb", "ssa", "rec"],
  emp_engie: ["sp", "rj", "bh", "cwb", "vix"],
  emp_vivante: ["sp", "bh", "gyn", "ssa"],
  emp_global: ["sp", "rj", "fln", "cwb"],
  emp_luandre: ["sp", "cwb", "poa"],
  emp_graber: ["sp", "bh", "vix"],
  emp_trademark: ["sp", "rj", "bsb"],
  emp_ecopolo: ["sp", "gyn", "mao"],
  emp_compart: ["sp", "cgb", "gyn"],
  emp_predial: ["sp", "rj"],
  emp_campseg: ["sp", "cwb"],
  emp_tlsv: ["sp", "slz"],
  emp_gpstec: ["sp", "bsb"],
};

/** Cidades atendidas pelo conjunto de empresas no escopo (com contagem). */
export function getLocais(empresaIds: string[]): LocalMapa[] {
  const cont = new Map<string, number>();
  for (const e of empresaIds) {
    for (const c of EMPRESA_CIDADES[e] ?? []) cont.set(c, (cont.get(c) ?? 0) + 1);
  }
  const byId = new Map(CIDADES.map((c) => [c.id, c]));
  return [...cont.entries()]
    .map(([cid, n]) => {
      const c = byId.get(cid);
      if (!c) return null;
      return { id: c.id, nome: c.nome, uf: c.uf, x: px(c.lon), y: py(c.lat), empresas: n };
    })
    .filter((x): x is LocalMapa => x !== null)
    .sort((a, b) => b.empresas - a.empresas);
}
