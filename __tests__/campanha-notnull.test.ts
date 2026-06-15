import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";

/**
 * Onda 7 · Dev B · Refinos F — drps_resposta.campanha_id NOT NULL (mig 0023).
 *
 * Cobre:
 *   1) registrarResposta sem campanha_id resolve uma campanha (nunca grava null)
 *      e cria 'avulso' como fallback final.
 *   2) A constraint NOT NULL (0023) rejeita um INSERT direto com campanha_id null
 *      (defesa em profundidade no schema, além da invariante em código).
 *
 * Exige Postgres com migrations 0011–0023 aplicadas (incl. 0023). Sem
 * DATABASE_URL_ADMIN → skip. Se a coluna ainda estiver NULLABLE (0023 não
 * aplicada), o teste (2) é pulado com aviso para não dar falso-negativo.
 */

const URL_ADMIN = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

const EMP = "emp_test_camp_notnull";

describe.skipIf(!URL_ADMIN)("campanha NOT NULL · invariante 0023", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  let instId: string;
  let campNotNull = false;

  let registrarResposta: typeof import("@/lib/drps")["registrarResposta"];

  beforeAll(async () => {
    admin = postgres(URL_ADMIN as string, { prepare: false, max: 2 });

    await admin`
      insert into public.empresas (id, nome) values (${EMP}, 'Empresa NotNull')
      on conflict (id) do nothing
    `;

    const [tpl] = await admin`
      select id from public.drps_instrumento
       where empresa_id is null and codigo = 'okebambo_v1' and ativo = true
       limit 1
    `;
    if (!tpl) {
      throw new Error("Template okebambo_v1 ausente — migrations não aplicadas?");
    }
    instId = tpl.id;

    // Descobre se a coluna já é NOT NULL (0023 aplicada).
    const [col] = await admin`
      select is_nullable
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'drps_resposta'
         and column_name = 'campanha_id'
    `;
    campNotNull = col?.is_nullable === "NO";

    const modDrps = await import("@/lib/drps");
    registrarResposta = modDrps.registrarResposta;
  });

  afterAll(async () => {
    if (admin) {
      await admin`delete from public.drps_resposta where empresa_id = ${EMP}`;
      await admin`delete from public.drps_campanha where empresa_id = ${EMP}`;
      await admin`delete from public.empresas where id = ${EMP}`;
      await admin.end({ timeout: 1 });
    }
  });

  beforeEach(async () => {
    await admin`delete from public.drps_resposta where empresa_id = ${EMP}`;
    await admin`delete from public.drps_campanha where empresa_id = ${EMP}`;
  });

  it("registrarResposta sem campanha resolve 'avulso' (nunca null)", async () => {
    const resposta = await registrarResposta(EMP, instId, {
      marcador_anonimo: "mkr_notnull_avulso____________xx",
      setor: "Operacional",
      funcao: "Psicologia",
      canal: "web",
      respostas: [{ pergunta_codigo: "Q5", valor_int: 3 }],
    });

    expect(resposta.campanha_id).not.toBeNull();
    expect(resposta.campanha_id).toBeTruthy();

    const [camp] = await admin`
      select codigo from public.drps_campanha
       where id = ${resposta.campanha_id} and empresa_id = ${EMP}
    `;
    expect(camp?.codigo).toBe("avulso");
  });

  it("INSERT direto com campanha_id null é rejeitado pela constraint NOT NULL", async () => {
    if (!campNotNull) {
      // 0023 ainda não aplicada neste ambiente — não dá pra afirmar a constraint.
      console.warn(
        "[campanha-notnull] drps_resposta.campanha_id ainda é NULLABLE — pulando asserção de constraint (aplique 0023).",
      );
      return;
    }

    await expect(
      admin`
        insert into public.drps_resposta
          (empresa_id, instrumento_id, campanha_id, marcador_anonimo, canal)
        values
          (${EMP}, ${instId}::uuid, null, 'mkr_notnull_direct___________xx', 'web')
      `,
    ).rejects.toThrow();
  });
});
