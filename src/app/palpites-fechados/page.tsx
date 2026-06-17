import { AppShell } from "@/components/app-shell";
import { TeamPill } from "@/components/team-pill";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { requireAuthenticatedViewer } from "@/lib/auth-guard";
import { getMatches, getPredictions, getProfiles } from "@/lib/data";
import { isMatchFinished, isPredictionLocked, scorePrediction } from "@/lib/scoring";
import type { Match, Prediction, Profile } from "@/lib/types";

function formatKickoffDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildPredictionKey(matchId: string, userId: string): string {
  return `${matchId}:${userId}`;
}

function getPredictionLabel(prediction: Prediction | undefined): string {
  if (!prediction) {
    return "N/A";
  }

  return `${prediction.homeGoals} x ${prediction.awayGoals}`;
}

function getPointsLabel(match: Match, prediction: Prediction | undefined): string {
  if (!isMatchFinished(match)) {
    return "-";
  }

  if (!prediction) {
    return "0 pts";
  }

  const result = scorePrediction(prediction, match);
  return `${result.points} pts`;
}

function sortProfiles(profiles: Profile[]): Profile[] {
  return [...profiles]
    .filter((profile) => profile.isActive)
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

export default async function PalpitesFechadosPage() {
  const viewer = await requireAuthenticatedViewer();
  const [matches, profiles, predictions] = await Promise.all([
    getMatches(),
    getProfiles(),
    getPredictions(),
  ]);

  const activeProfiles = sortProfiles(profiles);
  const predictionsByMatchUser = new Map(
    predictions.map((prediction) => [
      buildPredictionKey(prediction.matchId, prediction.userId),
      prediction,
    ]),
  );
  const lockedMatches = matches
    .filter((match) => isPredictionLocked(match))
    .sort(
      (left, right) =>
        new Date(right.kickoffAt).getTime() - new Date(left.kickoffAt).getTime(),
    );

  return (
    <AppShell
      title="Palpites Fechados"
      subtitle="Visao geral dos palpites de todos os participantes apos o bloqueio de cada jogo"
      viewer={viewer}
    >
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Surface className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Jogos bloqueados</p>
            <p className="font-display text-4xl leading-none md:text-5xl">
              {lockedMatches.length}
            </p>
          </Surface>
          <Surface className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Participantes ativos</p>
            <p className="font-display text-4xl leading-none md:text-5xl">
              {activeProfiles.length}
            </p>
          </Surface>
          <Surface className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Palpites salvos</p>
            <p className="font-display text-4xl leading-none md:text-5xl">
              {predictions.length}
            </p>
          </Surface>
        </div>

        {lockedMatches.length === 0 ? (
          <Surface className="p-8 text-center">
            <p className="text-lg font-semibold text-slate-100">
              Nenhum jogo com palpites fechados ainda.
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Esta tela libera os palpites quando o jogo chega a 30 minutos do inicio.
            </p>
          </Surface>
        ) : (
          <div className="space-y-4">
            {lockedMatches.map((match) => (
              <Surface key={match.id} className="p-4 md:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={isMatchFinished(match) ? "game_finished" : "bet_closed"}>
                        {isMatchFinished(match) ? "Jogo finalizado" : "Palpites fechados"}
                      </Badge>
                      {match.groupName ? (
                        <span className="text-xs uppercase tracking-wide text-slate-300">
                          Grupo {match.groupName}
                        </span>
                      ) : null}
                      {typeof match.roundNumber === "number" ? (
                        <span className="text-xs uppercase tracking-wide text-slate-300">
                          Rodada {match.roundNumber}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
                      <TeamPill teamName={match.homeTeam} />
                      <span className="font-display text-3xl text-white">
                        {isMatchFinished(match)
                          ? `${match.homeScore} x ${match.awayScore}`
                          : "vs"}
                      </span>
                      <TeamPill teamName={match.awayTeam} align="right" />
                    </div>
                  </div>
                  <div className="text-sm text-slate-300 lg:text-right">
                    <p>{formatKickoffDate(match.kickoffAt)}</p>
                    <p>{match.venue ?? "Estadio a definir"}</p>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                  <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr] bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    <span>Usuario</span>
                    <span>Palpite</span>
                    <span className="text-right">Pontuacao</span>
                  </div>
                  <div className="divide-y divide-white/10">
                    {activeProfiles.map((profile) => {
                      const prediction = predictionsByMatchUser.get(
                        buildPredictionKey(match.id, profile.id),
                      );

                      return (
                        <div
                          key={`${match.id}-${profile.id}`}
                          className="grid grid-cols-[1.4fr_0.8fr_0.7fr] gap-2 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-100">
                              {profile.displayName}
                            </p>
                            <p className="truncate text-xs text-slate-400">@{profile.username}</p>
                          </div>
                          <span className="self-center text-slate-100">
                            {getPredictionLabel(prediction)}
                          </span>
                          <span className="self-center text-right text-slate-100">
                            {getPointsLabel(match, prediction)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
