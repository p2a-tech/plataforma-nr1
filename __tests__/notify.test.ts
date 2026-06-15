import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Testes de integração da infra de notificação (Onda 6 · B).
 *
 * Cenário principal: SEM RESEND_API_KEY/SLACK_WEBHOOK_URL, `notificar()` deve
 * ser um no-op de despacho mas SEMPRE persistir a linha em `public.notificacoes`
 * (trilha). Também valida que `enviarEmail()` sem env não lança e devolve
 * canal 'nenhum'.
 *
 * Exige Postgres local. Sem DATABASE_URL_ADMIN → skip (CI sem DB).
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

// Garante o modo no-op: remove qualquer config de canal herdada do ambiente.
delete process.env.RESEND_API_KEY;
delete process.env.SLACK_WEBHOOK_URL;
delete process.env.NOTIFY_TO;

const TITULO = `teste-notify-${Date.now()}`;

describe.skipIf(!URL_ADMIN)("notify · no-op sem env persiste em notificacoes", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let notificar: typeof import("@/lib/notify")["notificar"];
  let enviarEmail: typeof import("@/lib/notify")["enviarEmail"];

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });
    const mod = await import("@/lib/notify");
    notificar = mod.notificar;
    enviarEmail = mod.enviarEmail;
  });

  afterAll(async () => {
    if (admin) {
      await admin`delete from public.notificacoes where titulo like ${TITULO + "%"}`;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`delete from public.notificacoes where titulo like ${TITULO + "%"}`;
  });

  it("notificar() persiste a linha com canal 'persistido' e status 'enfileirada'", async () => {
    const r = await notificar({
      tipo: "generico",
      titulo: TITULO,
      corpo: "corpo de teste",
    });
    expect(r.ok).toBe(false); // sem canal configurado → nada despachado
    expect(r.canal).toBe("persistido");

    const rows = await admin`
      select tipo, titulo, corpo, canal, status, empresa_id
        from public.notificacoes
       where titulo = ${TITULO}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].tipo).toBe("generico");
    expect(rows[0].canal).toBe("persistido");
    expect(rows[0].status).toBe("enfileirada");
    expect(rows[0].empresa_id).toBeNull();
  });

  it("notificar() grava o empresa_id quando informado", async () => {
    const EMP = "emp_test_notify";
    await admin`insert into public.empresas (id, nome) values (${EMP}, 'Notify Test')
                on conflict (id) do nothing`;
    try {
      await notificar({
        tipo: "risco_grave",
        empresa_id: EMP,
        titulo: `${TITULO}-emp`,
        corpo: "evento",
      });
      const [row] = await admin`
        select empresa_id, tipo from public.notificacoes where titulo = ${TITULO + "-emp"}
      `;
      expect(row.empresa_id).toBe(EMP);
      expect(row.tipo).toBe("risco_grave");
    } finally {
      await admin`delete from public.notificacoes where titulo = ${TITULO + "-emp"}`;
      await admin`delete from public.empresas where id = ${EMP}`;
    }
  });

  it("enviarEmail() sem env não lança e devolve canal 'nenhum'", async () => {
    const r = await enviarEmail({
      para: "ninguem@example.com",
      assunto: "x",
      html: "<p>x</p>",
      texto: "x",
    });
    expect(r.ok).toBe(false);
    expect(r.canal).toBe("nenhum");
  });
});
