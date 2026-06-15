import { TableSkeleton } from "@/components/ui/loading";

// /admin/empresas: resumo + filtro + tabela de empresas.
export default function Loading() {
  return <TableSkeleton rows={8} />;
}
