"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiTrendingUp } from "react-icons/fi";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import type { LeaderboardRow } from "@/lib/types";

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
}

type RankingMode = "overall" | "weekly";

function scoreByMode(row: LeaderboardRow, mode: RankingMode): number {
  if (mode === "overall") {
    return row.totalPoints;
  }
  return Math.max(
    0,
    Math.round(
      row.exactScores * 6 +
        row.goalDiffHits * 3 +
        row.resultHits * 2 +
        row.oneTeamGoalHits -
        Math.floor(row.predictionsCount / 6),
    ),
  );
}

function sortRows(rows: LeaderboardRow[], mode: RankingMode): LeaderboardRow[] {
  return [...rows].sort((left, right) => {
    const scoreDiff = scoreByMode(right, mode) - scoreByMode(left, mode);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    if (right.exactScores !== left.exactScores) {
      return right.exactScores - left.exactScores;
    }
    if (right.goalDiffHits !== left.goalDiffHits) {
      return right.goalDiffHits - left.goalDiffHits;
    }
    if (right.resultHits !== left.resultHits) {
      return right.resultHits - left.resultHits;
    }
    if (right.betPoints !== left.betPoints) {
      return right.betPoints - left.betPoints;
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

function formatBetPoints(points: number): string {
  return `${points > 0 ? "+" : ""}${points}`;
}

function podiumStyle(index: number): string {
  if (index === 0) {
    return "border-amber-300/60 bg-amber-500/12";
  }
  if (index === 1) {
    return "border-slate-300/55 bg-slate-200/10";
  }
  return "border-orange-400/45 bg-orange-600/10";
}

function medalTone(index: number): "champion" | "neutral" {
  return index === 0 ? "champion" : "neutral";
}

export function LeaderboardTable({ rows }: LeaderboardTableProps) {
  const [mode, setMode] = useState<RankingMode>("overall");

  const sortedRows = useMemo(() => sortRows(rows, mode), [rows, mode]);
  const podium = sortedRows.slice(0, 3);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--wb-border)] bg-white p-4 shadow-[0_10px_24px_rgba(7,29,73,0.06)]">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-[var(--wb-text)]">
            Leaderboard
          </h2>
          <p className="text-sm text-[var(--wb-muted)]">
            Classificação por pontos, acertos e consistência dos palpites.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("overall")}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              mode === "overall"
                ? "bg-[var(--wb-primary)] text-white"
                : "bg-slate-50 text-[var(--wb-muted)] hover:bg-blue-50",
            )}
          >
            Ranking geral
          </button>
          <button
            type="button"
            onClick={() => setMode("weekly")}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              mode === "weekly"
                ? "bg-[var(--wb-green)] text-white"
                : "bg-slate-50 text-[var(--wb-muted)] hover:bg-green-50",
            )}
          >
            Ranking semanal
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {podium.map((row, index) => (
          <motion.div
            key={`podium-${row.userId}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.05 }}
          >
            <Surface className={cn("p-4", podiumStyle(index))}>
              <div className="flex items-center justify-between">
                <p className="font-display text-4xl leading-none text-white">
                  {index + 1}
                </p>
                <Badge tone={medalTone(index)}>
                  {index === 0 ? "Gold" : index === 1 ? "Silver" : "Bronze"}
                </Badge>
              </div>
              <p className="mt-3 text-lg font-semibold text-slate-100">{row.displayName}</p>
              <p className="text-sm text-slate-300">
                {scoreByMode(row, mode)} pts {mode === "weekly" ? "na semana" : "no geral"}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                <FiTrendingUp />
                <span>{row.exactScores} placares exatos</span>
              </div>
              <p
                className={cn(
                  "mt-1 text-xs font-semibold",
                  row.betPoints > 0
                    ? "text-green-300"
                    : row.betPoints < 0
                      ? "text-red-300"
                      : "text-slate-300",
                )}
              >
                Saldo apostas: {formatBetPoints(row.betPoints)} pts
              </p>
            </Surface>
          </motion.div>
        ))}
      </div>

      <Surface className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-left">
            <tr className="text-xs uppercase tracking-wide text-slate-300">
              <th className="px-4 py-3">Pos</th>
              <th className="px-4 py-3">Participante</th>
              <th className="px-4 py-3">Pontos</th>
              <th className="px-4 py-3">Saldo apostas</th>
              <th className="px-4 py-3">Placar exato</th>
              <th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3">Dif. gols</th>
              <th className="px-4 py-3">Qtd palpites</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => (
              <tr
                key={row.userId}
                className="border-b border-white/5 text-slate-200 transition-colors hover:bg-white/5"
              >
                <td className="px-4 py-3 font-display text-2xl leading-none text-white/90">
                  {index + 1}
                </td>
                <td className="px-4 py-3 font-semibold">{row.displayName}</td>
                <td className="px-4 py-3 font-semibold text-blue-200">
                  {scoreByMode(row, mode)}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 font-semibold",
                    row.betPoints > 0
                      ? "text-green-300"
                      : row.betPoints < 0
                        ? "text-red-300"
                        : "text-slate-300",
                  )}
                >
                  {formatBetPoints(row.betPoints)}
                </td>
                <td className="px-4 py-3">{row.exactScores}</td>
                <td className="px-4 py-3">{row.resultHits}</td>
                <td className="px-4 py-3">{row.goalDiffHits}</td>
                <td className="px-4 py-3">{row.predictionsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>

      <div className="space-y-3 md:hidden">
        {sortedRows.map((row, index) => (
          <Surface key={`mobile-${row.userId}`} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-3xl leading-none text-white">{index + 1}</p>
                <p className="mt-1 text-base font-semibold text-slate-100">{row.displayName}</p>
              </div>
              <Badge tone={index === 0 ? "champion" : "upcoming"}>
                {scoreByMode(row, mode)} pts
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
              <p>Exato: {row.exactScores}</p>
              <p>Resultado: {row.resultHits}</p>
              <p>Dif. gols: {row.goalDiffHits}</p>
              <p>Palpites: {row.predictionsCount}</p>
              <p
                className={cn(
                  "col-span-2 font-semibold",
                  row.betPoints > 0
                    ? "text-green-300"
                    : row.betPoints < 0
                      ? "text-red-300"
                      : "text-slate-300",
                )}
              >
                Saldo apostas: {formatBetPoints(row.betPoints)} pts
              </p>
            </div>
          </Surface>
        ))}
      </div>

      {rows.length === 0 ? (
        <Surface className="p-8 text-center">
          <p className="text-lg font-semibold text-slate-100">Ranking vazio</p>
          <p className="text-sm text-slate-300">
            Ainda não há participantes com pontuação para exibir.
          </p>
        </Surface>
      ) : null}
    </section>
  );
}
