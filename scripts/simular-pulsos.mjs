#!/usr/bin/env node
/**
 * Simula respostas de micro-pulsos chegando ao Radar (canal-agnóstico).
 * Útil para demonstrar a Escuta Ativa "ao vivo" sem um número de WhatsApp.
 *
 *   node scripts/simular-pulsos.mjs            # 30 respostas
 *   node scripts/simular-pulsos.mjs 100        # 100 respostas
 *   node scripts/simular-pulsos.mjs 50 --url https://...
 */

const N = Number(process.argv.find((a) => /^\d+$/.test(a))) || 30;
const i = process.argv.indexOf("--url");
const URL_BASE = i >= 0 ? process.argv[i + 1] : "http://localhost:3000";

const setores = ["Logística", "Atendimento (SAC)", "Produção", "Administrativo", "Manutenção", "Comercial"];
const turnos = ["manha", "tarde", "noite", "madrugada"];
const canais = ["whatsapp", "whatsapp", "whatsapp", "app", "totem"];
const ofensores = [
  "sobrecarga_trabalho", "ritmo_pressao_metas", "conflito_lideranca",
  "jornada_descanso_insuficiente", "falta_reconhecimento", null,
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

let ok = 0;
for (let k = 0; k < N; k++) {
  const setor = pick(setores);
  const turno = pick(turnos);
  // Logística noturna tende a energia baixa (maior risco)
  const baixa = setor === "Logística" && (turno === "noite" || turno === "madrugada");
  const energia = baixa ? 1 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 3);
  const body = {
    empresa_id: process.env.EMPRESA_ID || "emp_translog",
    cluster_setor: setor,
    cluster_turno: turno,
    cluster_site: setor === "Logística" ? "SP-03" : undefined,
    canal: pick(canais),
    energia: Math.min(5, energia),
    ofensor: pick(ofensores) ?? undefined,
    duracao_seg: 20 + Math.floor(Math.random() * 30),
  };
  const r = await fetch(URL_BASE + "/api/radar/pulso", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.ok) ok++;
}
console.log(`Radar: ${ok}/${N} respostas simuladas enviadas a ${URL_BASE}`);
