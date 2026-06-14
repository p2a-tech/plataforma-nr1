import { TableSkeleton } from "@/components/ui/loading";

// /riscos: inventário em tabela (setor × fonte × severidade × prob × ação).
export default function Loading() {
  return <TableSkeleton rows={10} />;
}
