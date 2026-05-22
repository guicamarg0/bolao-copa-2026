"use client";

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

  return (
    <Surface
      className={cn(
        "relative h-full min-h-[265px] overflow-hidden p-4 md:p-5",
        featured
          ? "border-blue-300/40 bg-[linear-gradient(140deg,rgba(29,78,216,0.2),rgba(15,31,58,0.9))]"
          : "bg-[linear-gradient(145deg,rgba(17,35,66,0.72),rgba(10,24,47,0.9))]",
      )}
    >
      <div className="absolute -right-16 top-0 h-36 w-36 rounded-full bg-blue-400/18 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={finished ? "game_finished" : locked ? "bet_closed" : "bet_open"}>
              {finished
                ? "Jogo finalizado"
                : locked
                  ? "Palpites fechados"
                  : "Palpites em aberto"}
            </Badge>
            <Badge tone="neutral">{STAGE_LABEL[match.stage]}</Badge>
            {typeof match.roundNumber === "number" ? (
              <Badge tone="neutral">Rodada {match.roundNumber}</Badge>
            ) : null}
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-300">
            {match.groupName ? `Grupo ${match.groupName}` : "Mata-mata"}
          </p>
        </div>

        <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
          <TeamPill teamName={match.homeTeam} />
          <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-center">
            <p className="font-display text-3xl leading-none tracking-[0.08em] text-[var(--wb-ice)]">
              {finished
                ? `${match.homeScore ?? "-"} × ${match.awayScore ?? "-"}`
                : `${prediction?.homeGoals ?? "-"} × ${prediction?.awayGoals ?? "-"}`}
            </p>
          </div>
          <TeamPill teamName={match.awayTeam} align="right" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <p>{formatKickoff(match.kickoffAt)}</p>
          <p>{match.venue ?? "Estádio a definir"}</p>
        </div>

        {!finished ? (
          <div className="mt-auto rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-slate-200">
            {getMatchCountdown(match.kickoffAt)}
          </div>
        ) : (
          <div className="mt-auto" />
        )}
      </div>
    </Surface>
  );
}
