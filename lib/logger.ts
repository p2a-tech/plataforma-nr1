/**
 * Logger estruturado mínimo (JSON em uma linha) — zero dependências.
 *
 * Cada chamada imprime `{ level, msg, ts, ...meta }` em stdout/stderr, o que é
 * ingerível por qualquer coletor (Vercel, Loki, CloudWatch, Datadog…).
 *
 * Uso:
 *   import { logger } from "@/lib/logger";
 *   logger.info("pulso registrado", { id });
 *   const log = logger.child({ requestId });  // herda bindings
 *   log.error("falha ao gravar", { err: String(e) });
 *
 * Nível mínimo via LOG_LEVEL (debug < info < warn < error). Default: 'info'.
 */

type Level = "debug" | "info" | "warn" | "error";
type Meta = Record<string, unknown>;

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function nivelMinimo(): number {
  const env = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return ORDER[env as Level] ?? ORDER.info;
}

export interface Logger {
  debug(msg: string, meta?: Meta): void;
  info(msg: string, meta?: Meta): void;
  warn(msg: string, meta?: Meta): void;
  error(msg: string, meta?: Meta): void;
  /** Retorna um logger que mescla `bindings` em toda mensagem. */
  child(bindings: Meta): Logger;
}

function escrever(level: Level, bindings: Meta, msg: string, meta?: Meta): void {
  if (ORDER[level] < nivelMinimo()) return;

  const linha = JSON.stringify({
    level,
    msg,
    ts: new Date().toISOString(),
    ...bindings,
    ...meta,
  });

  // warn/error → stderr; demais → stdout.
  if (level === "error" || level === "warn") {
    console.error(linha);
  } else {
    console.log(linha);
  }
}

function criar(bindings: Meta = {}): Logger {
  return {
    debug: (msg, meta) => escrever("debug", bindings, msg, meta),
    info: (msg, meta) => escrever("info", bindings, msg, meta),
    warn: (msg, meta) => escrever("warn", bindings, msg, meta),
    error: (msg, meta) => escrever("error", bindings, msg, meta),
    child: (extra) => criar({ ...bindings, ...extra }),
  };
}

export const logger: Logger = criar();
