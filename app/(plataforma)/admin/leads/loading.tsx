import { TableSkeleton } from "@/components/ui/loading";

// /admin/leads: funil (5 cards) + filtros + tabela paginada.
export default function Loading() {
  return <TableSkeleton rows={12} />;
}
