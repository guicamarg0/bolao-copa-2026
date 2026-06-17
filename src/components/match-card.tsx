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
}

export function MatchCard({ match, prediction, featured = false }: MatchCardProps) {
  const finished = isMatchFinished(match);
  const locked = isPredictionLocked(match);

  const scoreboardLabel = finished
    ? `${match.homeScore ?? "-"} × ${match.awayScore ?? "-"}`
    : prediction
      ? `${prediction.homeGoals} × ${prediction.awayGoals}`
      : "VS";

  return (
    <Surface
      className={cn(
        "relative h-full min-h-[300px] overflow-hidden border-[var(--wb-border)] p-4 md:p-5",
        featured
          ? "bg-[linear-gradient(145deg,#ffffff,#eef4ff)]"
          : "bg-white",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--wb-primary),var(--wb-red),var(--wb-gold))]" />

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

            <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-semibold text-[var(--wb-primary)]">
              <FiCalendar className="text-sm" />
              {formatKickoff(match.kickoffAt)}
            </span>

            {match.groupName ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-semibold text-[var(--wb-primary)]">
                <FiUsers className="text-sm" />
                Grupo {match.groupName}
              </span>
            ) : null}

            {typeof match.roundNumber === "number" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-semibold text-[var(--wb-primary)]">
                <FiAward className="text-sm" />
                Rodada {match.roundNumber}
              </span>
            ) : null}
          </div>

          <p className="flex items-center gap-1 text-xs text-[var(--wb-muted)] md:text-sm">
            <FiMapPin className="text-sm" />
            {match.venue ?? "Estadio a definir"}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--wb-border)] bg-[var(--wb-surface-alt)] p-3 md:p-5">
          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
            <TeamPill teamName={match.homeTeam} variant="feature" />

            <div className="relative">
              <div className="wb-dark-panel rounded-xl border border-[var(--wb-primary)] bg-[linear-gradient(145deg,var(--wb-primary),var(--wb-primary-dark))] px-4 py-4 text-center shadow-[0_12px_30px_rgba(7,29,73,0.22)] md:px-6">
                <p className="font-display text-4xl leading-none tracking-[0.08em] text-white md:text-5xl">
                  {scoreboardLabel}
                </p>
              </div>
              <FiShield className="pointer-events-none absolute -right-2 -top-2 text-xl text-[var(--wb-gold)] md:text-2xl" />
            </div>

            <TeamPill teamName={match.awayTeam} variant="feature" align="right" />
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--wb-muted)] md:text-sm">
          <span>{STAGE_LABEL[match.stage]}</span>
          {!finished ? (
            <span className="rounded-lg border border-[var(--wb-border)] bg-white px-3 py-1.5">
              {getMatchCountdown(match.kickoffAt)}
            </span>
          ) : (
            <span className="rounded-lg border border-[var(--wb-border)] bg-white px-3 py-1.5">
              Partida encerrada
            </span>
          )}
        </div>
      </div>
    </Surface>
  );
}
