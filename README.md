# PrevIA — Preview navegável

Protótipo de alta fidelidade (mockup clicável) da plataforma **PrevIA — O Ecossistema Omni-SST**, por **P2A Tech**. Feito para apresentar a visão do produto a clínicas/empresas parceiras. **Não tem backend** — todos os dados são simulados no frontend.

> PrevIA ajuda empresas a cumprir a nova **NR-1** (riscos psicossociais) no modelo **Human-in-the-Loop**: a IA cuida do compliance organizacional (NR-1) e a clínica parceira cuida do indivíduo (NR-7).

## Como rodar

```bash
npm install
npm run dev
```

Abra **http://localhost:3000**. A tela de login leva ao painel pelo botão **Entrar na plataforma**.

> Build de produção: `npm run build && npm start`.

## Modo apresentação

No topo do painel há o botão **"Modo apresentação"**. Ele percorre automaticamente as telas principais (≈7s cada), com barra de progresso — ideal para demonstrar sem cliques. Clique em **"Parar tour"** para sair.

## Tema claro / escuro

O botão de **sol/lua** no header (e no canto da tela de login) alterna entre **tema escuro** (padrão) e **tema claro**. A escolha é salva no navegador. As cores são tokens em `app/globals.css` (blocos `.dark` e `.light`) — edite ali para ajustar a paleta de cada tema.

## Mapa das telas

| Rota | Tela | Destaque |
|------|------|----------|
| `/` | **Login / Splash** | Branding, motivo de radar, seletor de perfil (demo) |
| `/dashboard` | **Dashboard SST/Compliance** | Métricas, mapa de calor setor×turno, alertas preditivos, status do PGR |
| `/escuta` | **Escuta Ativa (Radar IA)** | Mockup de WhatsApp (micro-pulso 30s), adesão, anonimato |
| `/riscos` | **Inventário de Riscos & PGR vivo** | Matriz de risco 5×5, plano de ação, selo de validação humana |
| `/fluxo` | **Fluxo Human-in-the-Loop** | 4 passos (Radar→Acolhimento→Sigilo→Compliance) + barreira de sigilo |
| `/clinica` | **Portal da Clínica Parceira** | Funil de pacientes, agenda, tags de ofensores, KPIs B2B |
| `/conformidade` | **Conformidade & eSocial** | Checklist NR-1, eventos S-2210/S-2220/S-2240, trilha de auditoria |
| `/governanca` | **Governança & LGPD** | Toggles de privacidade, k-anonymity, protocolo de risco grave |

**Convenção de cor:** tudo que é **IA/plataforma = ciano**; tudo que é **cuidado humano/clínica = laranja**.

## Onde mexer nos dados (mock)

Tudo está em **`lib/mock-data.ts`** — um único arquivo, comentado por seção. Edite ali antes da reunião para refletir a realidade do parceiro:

- `empresa` — nome, segmento, nº de vidas/unidades.
- `profiles` — perfis do seletor (Gestor SST / Clínica / Admin).
- `metricas`, `heatmap`, `serieRisco`, `alertas`, `statusPGR` — Dashboard.
- `conversaPulso`, `adesaoCanais`, `respostasSemana`, `adesaoSetores` — Escuta Ativa.
- `inventarioRiscos` — Inventário de Riscos & PGR.
- `fluxoPassos` — Fluxo Human-in-the-Loop.
- `funilClinica`, `agendaClinica`, `ofensoresTags`, `indicadoresClinica` — Portal da Clínica.
- `checklistNR1`, `eventosESocial`, `trilhaAuditoria` — Conformidade.
- `togglesGovernanca` — Governança & LGPD.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · lucide-react · recharts. Fontes: Inter (corpo) + Fraunces (títulos, serif display).

## Estrutura

```
app/
  page.tsx                 # Login / splash
  (plataforma)/
    layout.tsx             # Sidebar + header + provider de estado
    dashboard/  escuta/  riscos/  fluxo/  clinica/  conformidade/  governanca/
components/
  brand/      # logo, ondas de radar
  layout/     # sidebar, header, shell, navegação
  ui/         # primitivos (Card, Badge, etc.)
  charts.tsx  # gráficos recharts
  heatmap.tsx # mapa de calor
lib/
  mock-data.ts  # << TODOS os dados ficam aqui
  app-state.tsx # perfil + modo apresentação
  utils.ts
```

> Ambiente de demonstração — dados fictícios. Alternar controles/toggles não afeta sistemas reais.
