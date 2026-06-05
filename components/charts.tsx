"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { serieRisco, respostasSemana, type PontoSerie } from "@/lib/mock-data";

const tooltipStyle = {
  background: "#081627",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#DCE9F5",
  fontSize: 12,
};

/** Dashboard: evolução do índice de risco (menor=melhor) × adesão aos pulsos. */
export function RiscoAdesaoChart({ data = serieRisco }: { data?: PontoSerie[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gRisco" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#FF6B35" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gAdesao" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00C2D1" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#00C2D1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="mes" stroke="#5B6B82" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#5B6B82" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
        <Area
          type="monotone"
          dataKey="risco"
          name="Índice de risco"
          stroke="#FF6B35"
          strokeWidth={2.5}
          fill="url(#gRisco)"
        />
        <Area
          type="monotone"
          dataKey="adesao"
          name="Adesão (%)"
          stroke="#00C2D1"
          strokeWidth={2.5}
          fill="url(#gAdesao)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Escuta: volume de respostas ao longo da semana. Aceita dados reais por prop. */
export function RespostasBarChart({
  data = respostasSemana,
}: {
  data?: { dia: string; respostas: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="dia" stroke="#5B6B82" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#5B6B82" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="respostas" name="Respostas" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.dia === "Sáb" || d.dia === "Dom" ? "#1c3a63" : "#00C2D1"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Mini-sparkline reutilizável (cards de métrica). */
export function Sparkline({ data, tone = "ia" }: { data: number[]; tone?: "ia" | "humano" | "ok" }) {
  const color = { ia: "#00C2D1", humano: "#FF6B35", ok: "#27AE60" }[tone];
  const pts = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={pts} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sp-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#sp-${tone})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
