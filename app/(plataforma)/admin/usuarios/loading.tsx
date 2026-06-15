import { TableSkeleton } from "@/components/ui/loading";

// /admin/usuarios: filtros + tabela de usuários.
export default function Loading() {
  return <TableSkeleton rows={10} />;
}
