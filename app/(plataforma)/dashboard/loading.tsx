import { DashboardSkeleton } from "@/components/ui/loading";

// /dashboard: cabeçalho + 6 cards + 2 painéis (heatmap + alertas). Espelha o layout real.
export default function Loading() {
  return <DashboardSkeleton />;
}
