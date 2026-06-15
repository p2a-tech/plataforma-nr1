import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";

/**
 * Estado vazio padrão das telas de dados.
 *
 * O banco de produção começa zerado — sem isto, as telas mostram tabelas vazias
 * ou zeros confusos. <EmptyState /> dá um "sem dados ainda" amigável + uma dica
 * de como popular, opcionalmente com uma ação (link/botão).
 *
 * Usa a paleta do projeto (.panel via <Card>, text-ink / text-ink-muted) e é
 * server-friendly (sem hooks). A `acao` pode ser um <Link>, <a> ou <button>.
 *
 * @example
 * <EmptyState
 *   icon={<Radio className="h-7 w-7" />}
 *   titulo="Sem pulsos ainda"
 *   descricao="Quando o Radar coletar respostas, os sinais por setor aparecem aqui."
 * />
 */
export function EmptyState({
  icon,
  titulo,
  descricao,
  acao,
  className,
}: {
  icon?: React.ReactNode;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ia/10 text-ia ring-1 ring-inset ring-ia/20"
        >
          {icon}
        </div>
      )}
      <div className="max-w-md">
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
          {titulo}
        </h3>
        {descricao && (
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">
            {descricao}
          </p>
        )}
      </div>
      {acao && <div className="mt-1">{acao}</div>}
    </Card>
  );
}

/**
 * Variante compacta para usar DENTRO de um <Card> já existente (ex.: corpo de um
 * painel cujo cabeçalho/título deve permanecer visível mesmo sem dados).
 * Não renderiza o painel — só o miolo centralizado.
 */
export function EmptyStateInline({
  icon,
  titulo,
  descricao,
  acao,
  className,
}: {
  icon?: React.ReactNode;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 px-4 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-ia/10 text-ia ring-1 ring-inset ring-ia/20"
        >
          {icon}
        </div>
      )}
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-ink">{titulo}</p>
        {descricao && (
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-muted">
            {descricao}
          </p>
        )}
      </div>
      {acao && <div className="mt-0.5">{acao}</div>}
    </div>
  );
}
