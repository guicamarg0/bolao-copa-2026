import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { TeamPill } from "@/components/team-pill";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { requireAuthenticatedViewer } from "@/lib/auth-guard";
import { getMatches, getPredictions, getProfiles } from "@/lib/data";
import { STAGE_LABEL } from "@/lib/match-ui";
import { isMatchFinished, scorePrediction } from "@/lib/scoring";
import type { Match, Prediction, Profile } from "@/lib/types";

function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.min(page, totalPages);
}

function getPageHref(page: number): string {
  return `/historico?page=${page}`;
}

function buildPredictionKey(matchId: string, userId: string): string {
  return `${matchId}:${userId}`;
}

function formatScore(match: Match): string {
  if (match.homeScore === null || match.awayScore === null) {
    return "-";
  }

  return `${match.homeScore} x ${match.awayScore}`;
}

function formatPrediction(prediction: Prediction | undefined): string {
  if (!prediction) {
    return "N/A";
  }

  return `${prediction.homeGoals} x ${prediction.awayGoals}`;
}

function getStageLabel(match: Match): string {
  const details = [
    match.groupName ? `Grupo ${match.groupName}` : null,
    typeof match.roundNumber === "number" ? `Rodada ${match.roundNumber}` : null,
  ].filter(Boolean);

  return details.length > 0
    ? `${STAGE_LABEL[match.stage]} - ${details.join(" - ")}`
    : STAGE_LABEL[match.stage];
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

function sortFinishedMatches(matches: Match[]): Match[] {
  return [...matches]
    .filter(isMatchFinished)
    .sort(
      (left, right) =>
        new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(),
    );
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const viewer = await requireAuthenticatedViewer();
  const query = await searchParams;
  const [matches, profiles, predictions] = await Promise.all([
    getMatches(),
    getProfiles(),
    getPredictions(),
  ]);

  const activeProfiles = sortProfiles(profiles);
  const totalPages = Math.max(1, activeProfiles.length);
  const requestedPage = query.page ? Number.parseInt(query.page, 10) : 1;
  const currentPage = clampPage(requestedPage, totalPages);
  const profile = activeProfiles[currentPage - 1] ?? null;
  const finishedMatches = sortFinishedMatches(matches);
  const predictionsByMatchUser = new Map(
    predictions.map((prediction) => [
      buildPredictionKey(prediction.matchId, prediction.userId),
      prediction,
    ]),
  );

  let runningTotal = 0;
  const rows = profile
    ? finishedMatches.map((match) => {
        const prediction = predictionsByMatchUser.get(buildPredictionKey(match.id, profile.id));
        const points = prediction ? scorePrediction(prediction, match).points : 0;
        runningTotal += points;

        return {
          match,
          prediction,
          points,
          runningTotal,
        };
      })
    : [];
  const predictionsCount = rows.filter((row) => Boolean(row.prediction)).length;

  return (
    <AppShell
      title="Historico"
      subtitle="Pontuacao acumulada por participante, jogo a jogo"
      viewer={viewer}
    >
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Surface className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Participante</p>
            <p className="truncate font-display text-2xl leading-tight md:text-3xl">
              {profile?.displayName ?? "Sem usuario"}
            </p>
          </Surface>
          <Surface className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">
              Pontos em palpites
            </p>
            <p className="font-display text-4xl leading-none md:text-5xl">
              {runningTotal}
            </p>
          </Surface>
          <Surface className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Palpites pontuados</p>
            <p className="font-display text-4xl leading-none md:text-5xl">
              {predictionsCount}
            </p>
          </Surface>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--wb-border)] bg-white px-3 py-2 text-sm shadow-[0_10px_24px_rgba(7,29,73,0.06)]">
          <p className="text-[var(--wb-muted)]">
            Usuario {currentPage} de {totalPages}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            {currentPage <= 1 ? (
              <span className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-[var(--wb-border)] px-3 text-xs font-semibold text-[var(--wb-muted)] opacity-50 sm:flex-none">
                Anterior
              </span>
            ) : (
              <Link
                href={getPageHref(currentPage - 1)}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-[var(--wb-border)] px-3 text-xs font-semibold text-[var(--wb-primary)] transition hover:bg-[#eef4ff] sm:flex-none"
              >
                Anterior
              </Link>
            )}
            <span className="wb-dark-panel inline-flex min-w-[48px] items-center justify-center rounded-lg border border-[var(--wb-border)] bg-[var(--wb-primary)] px-3 py-1.5 font-semibold text-white">
              {currentPage}
            </span>
            {currentPage >= totalPages ? (
              <span className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-[var(--wb-border)] px-3 text-xs font-semibold text-[var(--wb-muted)] opacity-50 sm:flex-none">
                Proximo
              </span>
            ) : (
              <Link
                href={getPageHref(currentPage + 1)}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-[var(--wb-border)] px-3 text-xs font-semibold text-[var(--wb-primary)] transition hover:bg-[#eef4ff] sm:flex-none"
              >
                Proximo
              </Link>
            )}
          </div>
        </div>

        {activeProfiles.length === 0 ? (
          <Surface className="p-8 text-center">
            <p className="text-lg font-semibold text-slate-100">
              Nenhum participante ativo encontrado.
            </p>
          </Surface>
        ) : finishedMatches.length === 0 ? (
          <Surface className="p-8 text-center">
            <p className="text-lg font-semibold text-slate-100">
              Nenhum jogo finalizado ainda.
            </p>
            <p className="mt-2 text-sm text-slate-300">
              O historico sera preenchido quando os resultados forem salvos.
            </p>
          </Surface>
        ) : (
          <Surface className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--wb-border)] bg-[var(--wb-surface-alt)] text-left text-xs uppercase tracking-wide text-[var(--wb-muted)]">
                    <th className="px-3 py-3 font-semibold">Fase</th>
                    <th className="px-3 py-3 font-semibold">Jogo</th>
                    <th className="px-3 py-3 font-semibold">Placar final</th>
                    <th className="px-3 py-3 font-semibold">Palpite</th>
                    <th className="px-3 py-3 text-right font-semibold">Pontuacao</th>
                    <th className="px-3 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--wb-border)]">
                  {rows.map(({ match, prediction, points, runningTotal: total }) => (
                    <tr key={match.id} className="align-middle">
                      <td className="px-3 py-3 text-[var(--wb-muted)]">
                        {getStageLabel(match)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="grid max-w-[320px] grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <TeamPill teamName={match.homeTeam} />
                          <span className="text-xs font-bold uppercase text-[var(--wb-muted)]">
                            x
                          </span>
                          <TeamPill teamName={match.awayTeam} align="right" />
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold">{formatScore(match)}</td>
                      <td className="px-3 py-3 font-semibold">
                        {formatPrediction(prediction)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Badge tone={points > 0 ? "finished" : "neutral"}>
                          {points} pts
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right font-display text-2xl">
                        {total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        )}
      </section>
    </AppShell>
  );
}
