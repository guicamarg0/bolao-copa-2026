"use client";

import { FiAward, FiCalendar, FiMapPin, FiShield, FiUsers } from "react-icons/fi";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { TeamPill } from "@/components/team-pill";
import { cn } from "@/lib/cn";
import { formatKickoff, getMatchCountdown, STAGE_LABEL } from "@/lib/match-ui";
import { isMatchFinished, isPredictionLocked } from "@/lib/scoring";
import type { Match, Prediction } from "@/lib/types";

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  featured?: boolean;
  matches?: Match[];
}

export function MatchCard({ match, prediction, featured = false, matches }: MatchCardProps) {
  const finished = isMatchFinished(match);
  const locked = isPredictionLocked(match, undefined, matches);

  const scoreboardLabel = finished
    ? `${match.homeScore ?? "-"} × ${match.awayScore ?? "-"}`
    : prediction
      ? `${prediction.homeGoals} × ${prediction.awayGoals}`
      : "VS";

  return (
    <Surface
      className={cn(
        "relative h-full min-h-[320px] overflow-hidden border-blue-300/35 p-4 md:p-5",
        featured
          ? "bg-[linear-gradient(145deg,rgba(22,53,103,0.9),rgba(8,24,52,0.96))]"
          : "bg-[linear-gradient(145deg,rgba(14,40,84,0.84),rgba(8,24,52,0.94))]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(29,78,216,0.25),transparent_45%),radial-gradient(circle_at_88%_85%,rgba(29,78,216,0.18),transparent_42%)]" />

      <div className="relative z-10 flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={finished ? "game_finished" : locked ? "bet_closed" : "bet_open"}>
              {finished
                ? "Jogo finalizado"
                : locked
                  ? "Palpites fechados"
                  : "Palpites em aberto"}
            </Badge>

            <span className="inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-blue-500/15 px-3 py-1 text-sm font-semibold text-slate-100">
              <FiCalendar className="text-sm text-blue-200" />
              {formatKickoff(match.kickoffAt)}
            </span>

            {match.groupName ? (
              <span className="inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-blue-500/12 px-3 py-1 text-sm font-semibold text-slate-100">
                <FiUsers className="text-sm text-blue-200" />
                Grupo {match.groupName}
              </span>
            ) : null}

            {typeof match.roundNumber === "number" ? (
              <span className="inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-blue-500/12 px-3 py-1 text-sm font-semibold text-slate-100">
                <FiAward className="text-sm text-blue-200" />
                Rodada {match.roundNumber}
              </span>
            ) : null}
          </div>

          <p className="flex items-center gap-1 text-xs text-slate-300 md:text-sm">
            <FiMapPin className="text-sm text-slate-400" />
            {match.venue ?? "Estadio a definir"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(7,22,48,0.86),rgba(7,19,42,0.95))] p-3 md:p-5">
          <div className="grid items-center gap-4 grid-cols-[1fr_auto_1fr]">
            <TeamPill teamName={match.homeTeam} variant="feature" />

            <div className="relative">
              <div className="rounded-[1.4rem] border border-blue-300/40 bg-[linear-gradient(145deg,rgba(10,31,67,0.95),rgba(8,20,44,0.98))] px-4 py-4 text-center shadow-[0_12px_30px_rgba(10,24,47,0.55)] md:px-6">
                <p className="font-display text-4xl leading-none tracking-[0.08em] text-white md:text-5xl">
                  {scoreboardLabel}
                </p>
              </div>
              <FiShield className="pointer-events-none absolute -right-2 -top-2 text-xl text-blue-200/80 md:text-2xl" />
            </div>

            <TeamPill teamName={match.awayTeam} variant="feature" align="right" />
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 md:text-sm">
          <span>{STAGE_LABEL[match.stage]}</span>
          {!finished ? (
            <span className="rounded-xl border border-white/12 bg-black/20 px-3 py-1.5">
              {getMatchCountdown(match.kickoffAt)}
            </span>
          ) : (
            <span className="rounded-xl border border-white/12 bg-black/20 px-3 py-1.5">
              Partida encerrada
            </span>
          )}
        </div>
      </div>
    </Surface>
  );
}
