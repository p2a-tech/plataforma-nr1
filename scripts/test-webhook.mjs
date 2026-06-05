#!/usr/bin/env node
/**
 * Smoke test do webhook clínica → PrevIA.
 *
 * Uso:
 *   node scripts/test-webhook.mjs                    # payload válido
 *   node scripts/test-webhook.mjs --forbidden        # tenta enviar 'transcript' (deve ser rejeitado)
 *   node scripts/test-webhook.mjs --bad-hmac         # assinatura errada
 *   node scripts/test-webhook.mjs --replay           # timestamp velho
 *   node scripts/test-webhook.mjs --url https://...  # contra produção
 */

import { createHmac } from "node:crypto";

const args = new Set(process.argv.slice(2));
const flag = (name) => args.has(name);
const valor = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};

const URL_BASE = valor("--url") ?? "http://localhost:3000";
const SECRET = process.env.CLIN_TEST_SECRET ?? "demo-secret-do-not-use-in-prod";
const CLINICA_ID = "clin_translog_demo";

// Hash hex aleatório (32 chars) — opaco, não-reidentificável
const sessionIdAnon = Array.from({ length: 32 }, () =>
  Math.floor(Math.random() * 16).toString(16),
).join("");

const payload = {
  session_id_anon: sessionIdAnon,
  clinica_id: CLINICA_ID,
  iniciada_em: new Date(Date.now() - 30 * 60_000).toISOString(),
  duracao_minutos: 28,
  cluster: {
    setor: "Logística",
    turno: "noite",
    site: "SP-03",
  },
  ofensores: [
    { tag: "sobrecarga_trabalho", confidence: 0.88, ocorrencias: 6 },
    { tag: "jornada_descanso_insuficiente", confidence: 0.71, ocorrencias: 3 },
  ],
  severidade_estimada: "alta",
  protocolo_emergencia_acionado: false,
  versao_extractor: "clinic-agent@0.1.0",
};

// Variantes pra demonstrar a barreira
if (flag("--forbidden")) {
  payload.transcript = "Paciente relatou cansaço crônico…"; // PROIBIDO
  payload.paciente_nome = "João da Silva"; // PROIBIDO
}

const rawBody = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000) - (flag("--replay") ? 3600 : 0);
const goodSig =
  "sha256=" + createHmac("sha256", SECRET).update(rawBody, "utf8").digest("hex");
const signature = flag("--bad-hmac") ? "sha256=" + "0".repeat(64) : goodSig;

console.log("→ POST", URL_BASE + "/api/webhook/sessao-finalizada");
console.log("  flags:", [...args].join(" ") || "(payload válido)");
console.log("  body:", rawBody.length, "bytes");
console.log("");

const res = await fetch(URL_BASE + "/api/webhook/sessao-finalizada", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-previa-signature": signature,
    "x-previa-timestamp": String(timestamp),
  },
  body: rawBody,
});

const json = await res.json().catch(() => ({}));
console.log(`← ${res.status} ${res.statusText}`);
console.log(JSON.stringify(json, null, 2));
process.exit(res.ok ? 0 : 1);
