"use client";

import { useState } from "react";
import { Card, CardTitle, Badge } from "@/components/ui/primitives";
import { LayoutList } from "lucide-react";
import { FatoresPorDimensao, type DimensaoBloco } from "./fatores-por-dimensao";
import { PainelPlano } from "./painel-plano";
import type { Classificacao } from "@/lib/drps-escoragem";

/**
 * Container client que une o acordeon (lista de fatores por dimensão) com o
 * drawer de plano sugerido. Sobe pra Page server como prop os dados já
 * processados; aqui só faz o glue de UI.
 */
export function SecaoFatoresNR1({ dimensoes }: { dimensoes: DimensaoBloco[] }) {
  const [aberto, setAberto] = useState<{
    fatorId: string;
    classificacao: Classificacao;
    fatorNome: string;
  } | null>(null);

  return (
    <Card>
      <CardTitle
        icon={<LayoutList className="h-5 w-5" />}
        hint="Catálogo NR-1 oficial · 5 dimensões · 35 fatores. Clique em 'Ver plano sugerido' para abrir o programa apropriado."
        action={<Badge tone="ia">{contagemTotal(dimensoes)} fatores</Badge>}
      >
        Fatores por dimensão
      </CardTitle>

      <FatoresPorDimensao
        dimensoes={dimensoes}
        onAbrirPlano={(fatorId, classificacao) => {
          const f = todos(dimensoes).find((x) => x.id === fatorId);
          setAberto({
            fatorId,
            classificacao,
            fatorNome: f?.nome ?? "Fator",
          });
        }}
      />

      <PainelPlano
        aberto={aberto ? { fatorId: aberto.fatorId, classificacao: aberto.classificacao } : null}
        fatorNome={aberto?.fatorNome ?? ""}
        onFechar={() => setAberto(null)}
      />
    </Card>
  );
}

function contagemTotal(d: DimensaoBloco[]) {
  return d.reduce((acc, x) => acc + x.fatores.length, 0);
}

function todos(d: DimensaoBloco[]) {
  return d.flatMap((x) => x.fatores);
}
