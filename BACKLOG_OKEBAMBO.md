# Backlog · DRPS Okêbambo

> **Fonte:** material real do Projeto NR-1 da **Clínica Okêbambo Saúde e Educação** (Porto Alegre · CNPJ 54.413.743/0001-12), cedido como referência clínica e operacional para o produto PrevIA.
>
> Este backlog substitui o modelo simplificado de "7 perguntas + energia 1-5" usado no MVP por um instrumento DRPS completo, alinhado à NR-1 (Portaria MTE 1.419/2024) e validado em campo.
>
> **Convenções:**
> - **P0** = implementado nesta Onda 4 · **P1** = próxima onda · **P2** = futuro
> - **Done** ✓ · **Em curso** ⚙ · **Pendente** ⏳
> - Cada item tem: descrição · critérios de aceite · dependências (DB / UI / API)

---

## 1. Catálogo NR-1 oficial (P0 ⚙)

35 fatores psicossociais formalmente reconhecidos pela NR-1, com mapeamento para 5 dimensões agregadoras.

**Dimensões (eixos de análise):**
1. **Organização do trabalho** — sobrecarga, ritmo, jornada, autonomia
2. **Carga emocional** — exposição ao sofrimento, intensidade afetiva
3. **Relações de trabalho** — comunicação, suporte da equipe e liderança
4. **Condições de trabalho** — ambiente físico, ruído, privacidade, ergonomia
5. **Segurança emocional** — assédio, violência, eventos traumáticos

**Fatores (35):**
Sobrecarga (excesso de demandas) · Subcarga (baixa demanda) · Ritmo e pressão por metas · Jornada/descanso insuficiente · Falta de pausas entre atendimentos · Falta de tempo para registros clínicos · Baixo controle/falta de autonomia · Baixa clareza de papel/função · Baixa justiça organizacional · Más relações no local de trabalho · Trabalho em condições de difícil comunicação · Trabalho remoto e isolado · Isolamento profissional · Conflitos entre profissionais · Falta de suporte/apoio no trabalho · Falta de suporte da coordenação · Falta de comunicação entre equipe · Carga emocional do trabalho · Atendimento de casos complexos · Contato constante com sofrimento psíquico · Envolvimento emocional com famílias · Atendimentos emocionalmente intensos · Cansaço emocional acumulado · Esgotamento emocional · Impacto na saúde mental · Espaço inadequado para atendimento · Falta de privacidade · Ruído ou interrupções · Iluminação inadequada · Postura inadequada · Permanência prolongada sentado · Ameaças ou agressividade de pacientes/familiares · Situações de crise emocional durante atendimentos · Assédio de qualquer natureza · Eventos violentos ou traumáticos · Má gestão de mudanças organizacionais · Baixas recompensas e reconhecimento.

**Critérios de aceite:**
- [ ] Migration `0011_catalogo_nr1.sql` com tabelas `dim_nr1` (5 dimensões) + `fator_nr1` (35 fatores, FK dimensão, mapeamento eSocial S-2240 quando aplicável)
- [ ] Seed idempotente (re-rodar mantém integridade)
- [ ] Query `lib/catalogo-nr1.ts` exporta `listarFatores()`, `porDimensao(dim)`, `dimensoesComContagem(empresaId)`
- [ ] Página `/riscos` mostra fatores classificados por dimensão (acordeon ou abas)

---

## 2. Instrumento DRPS · questionário de 21 perguntas (P0 ⚙)

Reproduz fielmente o questionário aplicado pela Okêbambo em campo (Google Forms → planilha).

**Demografia (4):**
- Q1 Setor (texto + dropdown configurável por empresa)
- Q2 Função/cargo
- Q3 Tempo de empresa (`< 6m` · `6m–1a` · `1–3a` · `> 3a`)
- Q4 Forma de atuação (`CLT` · `PJ` · `Autônomo` · `Terceirizado` · `Estágio`)

**Likert 1–5 inversa (12 questões), `Sempre=1 ... Nunca=5`:**
- Q5 Adequação da quantidade de atendimentos/tarefas
- Q6 Intervalos suficientes entre atendimentos
- Q7 Realização de registros/relatórios/planejamentos sem pressa
- Q8 Condições do ambiente
- Q9 Privacidade e tranquilidade nos atendimentos
- Q10 Ambiente acolhedor e respeitoso entre profissionais
- Q13 Suporte/espaço para discutir casos difíceis
- Q14 Apoio da equipe quando precisa
- Q15 Comunicação clara e respeitosa entre profissionais
- Q16 Conforto para falar sobre dificuldades

**Likert 1–3 (frequência emocional):**
- Q11 Lida com situações emocionalmente difíceis (`Raramente=1` · `Às vezes=2` · `Frequentemente=3`)
- Q12 Sente cansaço emocional após atendimentos/dias de trabalho

**Impacto/esgotamento (escala própria):**
- Q17 Trabalho impactou saúde emocional/mental (`Não=1` · `Levemente=2` · `Moderadamente=3` · `Significativamente=4`)
- Q18 Já se sentiu esgotado emocionalmente (`Nunca=1` · `Raramente=2` · `Às vezes=3` · `Frequentemente=4` · `Sempre=5`)

**Aberto / multi-choice (3):**
- Q19 (multi-choice) **Maior gerador de estresse**: Agenda e Agendamentos · Conflitos entre profissionais · Ruído ou interrupções · Falta de organização processual · Falta de suporte da coordenação · Falta de tempo para registros clínicos · Falta de privacidade · Outro (texto)
- Q20 (multi-choice) **Sugestões de melhoria**: Ajustes na agenda · Treinamento para manejo de crises · Intervalos mínimos entre atendimentos · Limite diário de pacientes · Reuniões efetivas de supervisão clínica · Gerenciamento presente · Outro (texto)
- Q21 Texto livre

**Critérios de aceite:**
- [ ] Migration `0012_drps_instrumento.sql`: tabelas `drps_instrumento`, `drps_pergunta` (com `tipo`, `escala`, `peso`, `dimensao_id`), `drps_opcao` (multi-choice)
- [ ] Migration `0013_drps_resposta.sql`: tabelas `drps_resposta` (1 por colaborador anônimo) + `drps_resposta_item` (1 por pergunta) + `drps_resposta_opcao` (multi-choice)
- [ ] Seed: questionário Okêbambo idêntico ao Word como **template padrão** (re-aproveitável por outras clínicas)
- [ ] API pública `POST /api/drps/responder` (k-anonimato mín. 7 antes de agregar)
- [ ] Página `/escuta/drps` (server) lista questionários ativos e índice de adesão por setor
- [ ] Formulário público `/r/drps/[token]` (sem auth, token único de campanha)

---

## 3. Escoragem e classificação automática (P0 ⚙)

Replica a planilha de análise da Okêbambo dentro da plataforma.

**Cálculo:**
- Média aritmética por colaborador (sobre Q5–Q16, normalizado pra escala 1–5).
- Média geral por setor e por dimensão.
- Faixas: **baixo** (≤ 2,0) · **moderado** (2,1–3,5) · **alto** (> 3,5).

**Crítica de inputs:**
- Resposta com < 70% das perguntas obrigatórias preenchidas → descartar do cálculo (com flag).
- Se k-anonimato < 7 na unidade agregadora → ocultar média e mostrar "amostra insuficiente".

**Critérios de aceite:**
- [ ] `lib/drps-escoragem.ts` puro (testável) com `calcularEscore(respostas)` e `classificar(score)`.
- [ ] Vitest cobre 4 casos: baixo, moderado, alto, amostra insuficiente.
- [ ] Página `/riscos` mostra ranking de dimensões com classificação cor-codificada (verde/âmbar/vermelho).

---

## 4. Matriz de Risco 3×3 (P0 ⚙)

Critérios oficialmente usados pela Okêbambo, alinhados ao guia NR-1.

|              | Impacto Baixo | Impacto Médio | Impacto Alto |
|--------------|---------------|---------------|--------------|
| Prob. Alta   | (não definido)| **Moderado**  | **Alto**     |
| Prob. Média  | Baixo         | Moderado      | Moderado     |
| Prob. Baixa  | Baixo         | Baixo         | Moderado     |

**Escalas auxiliares:**
- Probabilidade: `Baixa` (raro) · `Média` (às vezes) · `Alta` (frequente)
- Impacto: `Baixo` (desconforto leve) · `Médio` (estresse/desgaste moderado) · `Alto` (pode gerar adoecimento/esgotamento)

**Critérios de aceite:**
- [ ] Função `lib/matriz-risco.ts` com `classificarRisco(prob, impacto) → 'baixo'|'moderado'|'alto'`
- [ ] Sugestão automática de **probabilidade** a partir da frequência de respostas no fator (≥40% das respostas mencionando o ofensor → Alta; 15–40% → Média; <15% → Baixa)
- [ ] Componente `<MatrizRisco />` em `/riscos` com visualização 3×3 colorida e contagem de fatores por célula
- [ ] Cada fator do inventário recebe automaticamente prob+impacto+classificação

---

## 5. Plano de Ação · Programa Prevencionista × Interventivo (P0 ⚙)

Mapeia automaticamente cada fator de risco a um programa e a uma lista de ações pré-definidas.

**Programa Prevencionista** (riscos **baixo** e **moderado**):
- Estabelecer intervalos mínimos entre atendimentos
- Definir limite diário de pacientes por profissional
- Agendar reuniões periódicas de supervisão clínica
- Criar espaços de escuta entre profissionais
- Promover treinamento para manejo de crises
- Ajustes operacionais na agenda
- Reservar tempo dedicado para registros clínicos
- Garantir salas silenciosas e organizadas
- Garantir privacidade durante atendimentos
- Ajustar mobiliário para conforto ergonômico

**Programa Interventivo** (riscos **alto** e **crítico**):
- Encaminhamento individual à clínica parceira (NR-7)
- Suspensão temporária da exposição ao fator (ex.: redirecionar agenda)
- Investigação raiz pela CIPA + DPO
- Ativação do protocolo de risco grave/iminente (E8) se houver indicador de emergência
- Plano de retorno acompanhado com responsável técnico

**Critérios de aceite:**
- [ ] Migration `0014_planos_acao.sql`: tabelas `acao_recomendada` (catálogo) + `plano_acao` (atribuído a uma empresa+fator) com `programa: prevencionista|interventivo`, `responsavel_setor`, `prazo`, `como_realizar`, `status`
- [ ] Seed: 16 ações da Okêbambo como catálogo padrão
- [ ] `lib/plano-acao.ts` com `sugerirPlano(empresaId, fatorId, classificacao)` que devolve ações filtradas pelo programa correto
- [ ] Página `/riscos/[fatorId]` mostra fator + classificação + plano sugerido + botões "atribuir responsável" e "definir prazo"
- [ ] Coluna no PGR exporta o plano de ação completo

---

## 6. PGR no formato Okêbambo (P0 ⚙)

Estrutura validada juridicamente e usada em fiscalização real.

**Seções obrigatórias:**
1. **Identificação da empresa** — razão social, nome fantasia, CNPJ, endereço, **responsável técnico** (com registro profissional, ex.: CRP), número de profissionais
2. **Objetivo do PGR** — declaração de propósito (saúde, segurança, bem-estar)
3. **Caracterização das atividades** — descrição operacional + público atendido
4. **Identificação dos riscos ocupacionais** subdividida em **4.1 Físicos · 4.2 Ergonômicos · 4.3 Psicossociais** (a PrevIA preenche 4.3 automaticamente; 4.1 e 4.2 são manuais)
5. **Avaliação dos riscos** — matriz 3×3 (vide §4) por fator
6. **Plano de ação** — agrupado por dimensão (Organização / Apoio / Ambiente / Carga / Segurança), com **como realizar**, **responsável de setor** e **prazo**
7. **Monitoramento dos riscos** — periodicidade (anual ou em mudanças), gatilhos (aumento equipe, novas demandas, percepção dos profissionais)
8. **Registro e documentação** — diagnóstico, matriz, plano, monitoramento (hash SHA-256 + selo HMAC já implementados na Onda anterior)
9. **Responsável pela elaboração** — nome, registro profissional, data, assinatura digital

**Critérios de aceite:**
- [ ] Migration `0015_pgr_okebambo.sql`: estender `pgr_revisao` com `responsavel_tecnico_nome`, `responsavel_tecnico_registro`, `responsavel_tecnico_conselho` (CRP/CRM/CREA), `endereco`, `cnpj`, `razao_social`, `nome_fantasia`, `publico_atendido` (texto), `descricao_atividades` (texto)
- [ ] Update do `lib/pgr-pdf.ts` para gerar PDF com as 9 seções acima (substituindo o formato simplificado atual)
- [ ] UI em `/pgr` permite preencher e revisar todos os campos antes da assinatura
- [ ] Re-geração mantém compatibilidade com hash+selo (campos adicionais entram no canonicalizador)

---

## 7. Análise setorizada / drill-down (P1 ⏳)

Replicar a aba "Análise Setorizada dos Registros" do Excel da Okêbambo.

**Recursos:**
- Filtrar respostas por setor / função / tempo de empresa / forma de contratação
- Comparar média do setor vs. média geral
- Identificar setores acima da média de risco (outliers)
- Heatmap setor × dimensão (5 dimensões da NR-1)
- Painel "Risco por contrato" (CLT vs PJ vs Autônomo) — corte importante para fiscalização MPT

**Critérios de aceite:**
- [ ] Query `lib/drps-analise.ts` com `analisePorSetor(empresaId)`, `analisePorContrato(empresaId)`, `outliersSetoriais(empresaId)`
- [ ] Página `/escuta/analise` com filtros e heatmap
- [ ] Exportação CSV/XLSX da análise para envio ao auditor

---

## 8. Comparativo histórico (P1 ⏳)

Acompanhar evolução de cada dimensão e fator ao longo dos ciclos.

**Recursos:**
- Série temporal por dimensão (5 linhas)
- Comparar 2 ciclos lado a lado (ex.: pré e pós intervenção)
- Detectar regressão (dimensão piorou > 0,5 pontos entre ciclos → alerta SST)

**Critérios de aceite:**
- [ ] `lib/drps-historico.ts` com `serieDimensoes(empresaId, fromDate, toDate)` e `compararCiclos(a, b)`
- [ ] Componente `<EvolucaoDimensoes />` em `/escuta`

---

## 9. Importador de Google Forms (P1 ⏳)

Muitas clínicas pequenas já usam Forms. Suporte de importação reduz fricção de adoção.

**Recursos:**
- Upload de CSV exportado do Google Forms
- Mapeamento automático de colunas → perguntas DRPS (via heurística por título)
- Validação e dry-run antes do import
- Idempotência (re-import não duplica)

**Critérios de aceite:**
- [ ] Endpoint `POST /api/drps/importar` (gated sst/admin) aceita CSV
- [ ] UI em `/escuta/importar` com preview e mapeamento manual

---

## 10. Análises preditivas (P2 ⏳)

Camada de IA aplicada ao DRPS — agora com dataset real para treinar/avaliar.

**Hipóteses a testar:**
- Predição de turnover por dimensão (Q14 + Q16 + Q18)
- Burnout score composto (Maslach simplificado) calculado a partir de Q11+Q12+Q17+Q18
- Detecção de assédio velado em textos abertos (Q19/Q20/Q21) via classificador

**Critérios de aceite:**
- Definidos quando houver volume mínimo de respostas (≥ 500 por empresa).

---

## 11. Catálogo de papéis profissionais (P1 ⏳)

Para clínicas o instrumento precisa reconhecer cargos clínicos específicos.

**Setores tipados:**
- Diretoria Geral
- Coordenação Técnica
- Operacional (atendimentos)
- Administrativa
- Apoio (recepção, limpeza, segurança)
- Comercial
- Terceirizado

**Cargos clínicos típicos:**
Psicologia, Psicopedagogia, Fonoaudiologia, Terapia Ocupacional, Fisioterapia, Medicina, Enfermagem, Atendente, Gestora, Financeiro, Comercial, Artesão (recursos terapêuticos), Higienização, Manutenção.

**Critérios de aceite:**
- [ ] Tabela `cargo_clinico` (id, nome, conselho_profissional?, area)
- [ ] Empresa pode adicionar cargos próprios mantendo o catálogo base como sugestão
- [ ] Q2 do DRPS usa autocomplete com este catálogo

---

## Rastreabilidade · do material ao produto

| Material original (Okêbambo) | Onde vira na PrevIA |
|------------------------------|---------------------|
| Word "Etapas do DRPS" | seções 1 (catálogo) + 2 (instrumento) + 3 (escoragem) deste backlog |
| Word "Modelo PGR" | seção 6 |
| Word "PGR Okêbambo" (caso real) | exemplo de seed/onboarding, vira tutorial para outras clínicas |
| `matriz_riscos_psicossociais_clinicas.xlsx` | seção 4 + 5 |
| `planilha_diagnostico_psicossocial_clinicas_Modelo.xlsx` | seção 3 (escoragem) + 7 (análise setorizada) |
| `Questionário DRPS - NR1 (respostas).xlsx` | seção 2 (instrumento) + dataset de teste |
| `Planilha Dados DRPS Okêbambo.xlsx` | base de calibração de pesos e thresholds |
| Portaria MTE 1.419/2024 + Guia NR-1 (PDFs) | já consumido em `/juridico` (Base Legal); referência cruzada nos fatores |

---

## Onda 4 · em curso

Os itens **P0** acima estão sendo implementados em paralelo por 3 devs + 1 revisor:

- **Dev A** · Catálogo NR-1 + instrumento DRPS (§1 + §2)
- **Dev B** · Escoragem + Matriz 3×3 + Plano de Ação (§3 + §4 + §5)
- **Dev C** · PGR formato Okêbambo (§6) + UI integrada
- **Revisor** · auditoria de DB/RLS/RBAC/tipos/integração

Após esta onda os itens P1 entram em fila para a próxima.
