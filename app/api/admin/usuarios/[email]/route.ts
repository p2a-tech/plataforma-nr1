/**
 * PATCH /api/admin/usuarios/[email]
 *   Ações sobre um usuário existente:
 *     - { acao: "ativar",   ativo: boolean }     → setUsuarioAtivo
 *     - { acao: "resetar_senha", novaSenha? }    → resetarSenhaUsuario
 *       (se novaSenha ausente, gera uma temporária e a devolve UMA vez)
 *
 * Gate: somente papel `admin`. Body validado com Zod .strict().
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessao } from "@/lib/auth";
import {
  setUsuarioAtivo,
  resetarSenhaUsuario,
  gerarSenhaTemporaria,
  statusDoErro,
} from "@/lib/admin-gestao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .discriminatedUnion("acao", [
    z.object({ acao: z.literal("ativar"), ativo: z.boolean() }).strict(),
    z
      .object({
        acao: z.literal("resetar_senha"),
        novaSenha: z.string().min(8).max(200).optional(),
      })
      .strict(),
  ]);

export async function PATCH(req: NextRequest, { params }: { params: { email: string } }) {
  const sessao = getSessao();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao.papel !== "admin") return NextResponse.json({ erro: "Apenas Admin" }, { status: 403 });

  const email = decodeURIComponent(params.email ?? "").trim();
  if (!email) return NextResponse.json({ erro: "e-mail ausente" }, { status: 400 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "validacao", detalhe: parsed.error.issues.map((i) => i.message) },
      { status: 422 },
    );
  }

  if (parsed.data.acao === "ativar") {
    const res = await setUsuarioAtivo(email, parsed.data.ativo);
    if (!res.ok) {
      return NextResponse.json(
        { erro: res.erro, detalhe: res.detalhe },
        { status: statusDoErro(res.erro) },
      );
    }
    return NextResponse.json({ ok: true, usuario: res.data });
  }

  // resetar_senha
  const novaSenha = parsed.data.novaSenha ?? gerarSenhaTemporaria();
  const res = await resetarSenhaUsuario(email, novaSenha);
  if (!res.ok) {
    return NextResponse.json(
      { erro: res.erro, detalhe: res.detalhe },
      { status: statusDoErro(res.erro) },
    );
  }
  return NextResponse.json({ ok: true, usuario: res.data, senhaTemporaria: novaSenha });
}
