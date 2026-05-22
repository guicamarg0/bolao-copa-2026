"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { isMatchFinished, isPredictionLocked } from "@/lib/scoring";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { TeamPill } from "@/components/team-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Surface } from "@/components/ui/surface";
import { ToastStack, type ToastItem, type ToastKind } from "@/components/ui/toast-stack";
import type { Match, MatchOutcome, Prediction, Viewer } from "@/lib/types";

interface PredictionBoardProps {
  matches: Match[];
  initialPredictions: Prediction[];
  viewer: Viewer;
  supabaseEnabled: boolean;
}

interface LocalDraft {
  homeGoals: string;
  awayGoals: string;
}

const PAGE_SIZE = 6;

function toPredictionMap(predictions: Prediction[]): Record<string, Prediction> {
  return predictions.reduce<Record<string, Prediction>>((accumulator, prediction) => {
    accumulator[prediction.matchId] = prediction;
    return accumulator;
  }, {});
}

function buildDrafts(predictions: Record<string, Prediction>): Record<string, LocalDraft> {
  const drafts: Record<string, LocalDraft> = {};
  for (const prediction of Object.values(predictions)) {
    drafts[prediction.matchId] = {
      homeGoals: String(prediction.homeGoals),
      awayGoals: String(prediction.awayGoals),
    };
  }
  return drafts;
}

function outcomeFromDraft(draft: LocalDraft | undefined): MatchOutcome | null {
  if (!draft) {
    return null;
  }
  const home = Number(draft.homeGoals);
  const away = Number(draft.awayGoals);
  if (!Number.isInteger(home) || !Number.isInteger(away)) {
    return null;
  }
  if (home === away) {
    return "draw";
  }
  return home > away ? "home" : "away";
}

function formatKickoffDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PredictionBoard({
  matches,
  initialPredictions,
  viewer,
  supabaseEnabled,
}: PredictionBoardProps) {
  const [predictionsByMatch, setPredictionsByMatch] = useState<Record<string, Prediction>>(() =>
    toPredictionMap(initialPredictions),
  );
  const [drafts, setDrafts] = useState<Record<string, LocalDraft>>(() =>
    buildDrafts(toPredictionMap(initialPredictions)),
  );
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [groupFilter, setGroupFilter] = useState<"all" | string>("all");
  const [roundFilter, setRoundFilter] = useState<"all" | string>("all");
  const [page, setPage] = useState(1);

  const orderedMatches = useMemo(() => {
    return [...matches].sort((left, right) => {
      return new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime();
    });
  }, [matches]);

  const filteredMatches = useMemo(() => {
    return orderedMatches.filter((match) => {
      if (groupFilter !== "all" && match.groupName !== groupFilter) {
        return false;
      }
      if (
        roundFilter !== "all" &&
        match.roundNumber !== Number.parseInt(roundFilter, 10)
      ) {
        return false;
      }

      if (statusFilter === "open") {
        return !isPredictionLocked(match);
      }
      if (statusFilter === "closed") {
        return isPredictionLocked(match);
      }
      return true;
    });
  }, [groupFilter, orderedMatches, roundFilter, statusFilter]);

  const groupOptions = useMemo(() => {
    const unique = new Set(
      orderedMatches
        .map((match) => match.groupName)
        .filter((group): group is string => Boolean(group)),
    );

    return Array.from(unique.values()).sort((left, right) =>
      left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" }),
    );
  }, [orderedMatches]);

  const roundOptions = useMemo(() => {
    const unique = new Set(
      orderedMatches
        .map((match) => match.roundNumber)
        .filter((round): round is number => Number.isInteger(round)),
    );

    return Array.from(unique.values()).sort((left, right) => left - right);
  }, [orderedMatches]);

  const predictionHistory = useMemo(() => {
    return orderedMatches
      .filter((match) => isPredictionLocked(match))
      .map((match) => ({
        match,
        prediction: predictionsByMatch[match.id],
      }))
      .filter((entry) => Boolean(entry.prediction));
  }, [orderedMatches, predictionsByMatch]);

  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedMatches = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredMatches.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredMatches]);

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function pushToast(message: string, kind: ToastKind) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => dismissToast(id), 4200);
  }

  function setDraftValue(matchId: string, field: keyof LocalDraft, value: string) {
    setDrafts((previous) => ({
      ...previous,
      [matchId]: {
        homeGoals: previous[matchId]?.homeGoals ?? "",
        awayGoals: previous[matchId]?.awayGoals ?? "",
        [field]: value,
      },
    }));
  }

  function chooseOutcome(match: Match, outcome: MatchOutcome) {
    const current = drafts[match.id] ?? { homeGoals: "", awayGoals: "" };
    const home = Number(current.homeGoals);
    const away = Number(current.awayGoals);

    if (outcome === "draw") {
      const score = Number.isInteger(home) ? home : Number.isInteger(away) ? away : 1;
      setDraftValue(match.id, "homeGoals", String(score));
      setDraftValue(match.id, "awayGoals", String(score));
      return;
    }

    if (outcome === "home") {
      setDraftValue(match.id, "homeGoals", Number.isInteger(home) ? String(home) : "1");
      setDraftValue(
        match.id,
        "awayGoals",
        Number.isInteger(away) && away < Number(home) ? String(away) : "0",
      );
      return;
    }

    setDraftValue(match.id, "awayGoals", Number.isInteger(away) ? String(away) : "1");
    setDraftValue(
      match.id,
      "homeGoals",
      Number.isInteger(home) && home < Number(away) ? String(home) : "0",
    );
  }

  async function savePrediction(match: Match) {
    if (!viewer.id) {
      pushToast("Faca login para enviar palpites.", "error");
      return;
    }

    if (isPredictionLocked(match)) {
      pushToast("Palpite fora do horario: jogo bloqueado.", "error");
      return;
    }

    const draft = drafts[match.id];
    const homeGoals = Number(draft?.homeGoals);
    const awayGoals = Number(draft?.awayGoals);

    if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals)) {
      pushToast("Informe numeros inteiros para os dois placares.", "error");
      return;
    }

    if (homeGoals < 0 || awayGoals < 0) {
      pushToast("Os gols nao podem ser negativos.", "error");
      return;
    }

    setSavingMatchId(match.id);

    try {
      if (supabaseEnabled) {
        const client = getSupabaseBrowserClient();
        if (!client) {
          throw new Error("Supabase nao configurado no cliente.");
        }

        const { data, error: upsertError } = await client
          .from("predictions")
          .upsert(
            {
              user_id: viewer.id,
              match_id: match.id,
              home_goals: homeGoals,
              away_goals: awayGoals,
            },
            { onConflict: "user_id,match_id" },
          )
          .select("*")
          .maybeSingle();

        if (upsertError) {
          throw upsertError;
        }

        const updatedPrediction: Prediction = {
          id: String(data?.id ?? `${viewer.id}-${match.id}`),
          userId: String(data?.user_id ?? viewer.id),
          matchId: String(data?.match_id ?? match.id),
          homeGoals: Number(data?.home_goals ?? homeGoals),
          awayGoals: Number(data?.away_goals ?? awayGoals),
          createdAt: String(data?.created_at ?? new Date().toISOString()),
          updatedAt: String(data?.updated_at ?? new Date().toISOString()),
        };

        setPredictionsByMatch((previous) => ({
          ...previous,
          [match.id]: updatedPrediction,
        }));
      } else {
        const response = await fetch("/api/local-predictions/upsert", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            matchId: match.id,
            homeGoals,
            awayGoals,
          }),
        });

        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          prediction?: Prediction;
        };

        if (!response.ok || !payload.ok || !payload.prediction) {
          throw new Error(payload.error ?? "Nao foi possivel salvar o palpite.");
        }

        setPredictionsByMatch((previous) => ({
          ...previous,
          [match.id]: payload.prediction as Prediction,
        }));
      }

      pushToast(`Palpite salvo para ${match.homeTeam} x ${match.awayTeam}.`, "success");
    } catch (caughtError) {
      pushToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Nao foi possivel salvar o palpite.",
        "error",
      );
    } finally {
      setSavingMatchId(null);
    }
  }

  const openMatches = orderedMatches.filter((match) => !isPredictionLocked(match)).length;
  const closedMatches = orderedMatches.length - openMatches;

  return (
    <section className="space-y-5">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {matches.length === 0 ? (
        <Surface className="p-8 text-center">
          <p className="text-lg font-semibold text-slate-100">Nenhum jogo cadastrado</p>
          <p className="text-sm text-slate-300">
            Assim que partidas forem adicionadas, seus palpites aparecerao aqui.
          </p>
        </Surface>
      ) : null}

      {matches.length > 0 ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Surface className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-300">Partidas abertas</p>
              <p className="font-display text-5xl leading-none">{openMatches}</p>
            </Surface>
            <Surface className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-300">Partidas fechadas</p>
              <p className="font-display text-5xl leading-none">{closedMatches}</p>
            </Surface>
            <Surface className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-300">Palpites salvos</p>
              <p className="font-display text-5xl leading-none">
                {Object.keys(predictionsByMatch).length}
              </p>
            </Surface>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
              <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                Exibir partidas
                <Select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as "all" | "open" | "closed");
                    setPage(1);
                  }}
                >
                  <option value="all">Todas</option>
                  <option value="open">Palpites em aberto</option>
                  <option value="closed">Palpites fechados/finalizados</option>
                </Select>
              </label>
              <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                Grupo
                <Select
                  value={groupFilter}
                  onChange={(event) => {
                    setGroupFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Todos os grupos</option>
                  {groupOptions.map((group) => (
                    <option key={group} value={group}>
                      Grupo {group}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                Rodada
                <Select
                  value={roundFilter}
                  onChange={(event) => {
                    setRoundFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Todas as rodadas</option>
                  {roundOptions.map((round) => (
                    <option key={round} value={String(round)}>
                      Rodada {round}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setGroupFilter("all");
                    setRoundFilter("all");
                    setPage(1);
                  }}
                >
                  Limpar
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {paginatedMatches.length === 0 ? (
              <Surface className="p-6 text-center">
                <p className="text-sm text-slate-300">
                  Nenhum jogo encontrado para o filtro selecionado.
                </p>
              </Surface>
            ) : (
              paginatedMatches.map((match, index) => {
                const finished = isMatchFinished(match);
                const locked = isPredictionLocked(match);
                const draft = drafts[match.id] ?? { homeGoals: "", awayGoals: "" };
                const draftOutcome = outcomeFromDraft(draft);

                return (
                  <motion.article
                    key={match.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: index * 0.02 }}
                  >
                    <Surface className="h-full min-h-[320px] overflow-hidden p-4 md:p-5">
                      <div className="flex h-full flex-col">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              tone={
                                finished ? "game_finished" : locked ? "bet_closed" : "bet_open"
                              }
                            >
                              {finished
                                ? "Jogo finalizado"
                                : locked
                                  ? "Palpites fechados"
                                  : "Palpites em aberto"}
                            </Badge>
                            <Badge tone="neutral">{formatKickoffDate(match.kickoffAt)}</Badge>
                            {match.groupName ? (
                              <Badge tone="neutral">Grupo {match.groupName}</Badge>
                            ) : null}
                            {typeof match.roundNumber === "number" ? (
                              <Badge tone="neutral">Rodada {match.roundNumber}</Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-300">
                            {match.venue ?? "Estadio a definir"}
                          </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                          <TeamPill teamName={match.homeTeam} />
                          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center">
                            <p className="font-display text-2xl leading-none tracking-[0.08em]">
                              VS
                            </p>
                          </div>
                          <TeamPill teamName={match.awayTeam} align="right" />
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                          <Input
                            type="number"
                            min={0}
                            disabled={locked}
                            value={draft.homeGoals}
                            onChange={(event) =>
                              setDraftValue(match.id, "homeGoals", event.target.value)
                            }
                            placeholder={`Gols ${match.homeTeam}`}
                          />

                          <Input
                            type="number"
                            min={0}
                            disabled={locked}
                            value={draft.awayGoals}
                            onChange={(event) =>
                              setDraftValue(match.id, "awayGoals", event.target.value)
                            }
                            placeholder={`Gols ${match.awayTeam}`}
                          />

                          <Button
                            type="button"
                            disabled={locked || savingMatchId === match.id}
                            onClick={() => void savePrediction(match)}
                            className="md:min-w-[160px]"
                          >
                            {savingMatchId === match.id ? "Salvando..." : "Salvar palpite"}
                          </Button>
                        </div>

                        <div className="mt-auto pt-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => chooseOutcome(match, "home")}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                draftOutcome === "home"
                                  ? "bg-blue-500/35 text-blue-100"
                                  : "bg-white/5 text-slate-300 hover:bg-white/10"
                              }`}
                            >
                              Vitoria {match.homeTeam}
                            </button>
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => chooseOutcome(match, "draw")}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                draftOutcome === "draw"
                                  ? "bg-amber-500/35 text-amber-100"
                                  : "bg-white/5 text-slate-300 hover:bg-white/10"
                              }`}
                            >
                              Empate
                            </button>
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => chooseOutcome(match, "away")}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                draftOutcome === "away"
                                  ? "bg-green-500/35 text-emerald-100"
                                  : "bg-white/5 text-slate-300 hover:bg-white/10"
                              }`}
                            >
                              Vitoria {match.awayTeam}
                            </button>
                          </div>
                        </div>
                      </div>
                    </Surface>
                  </motion.article>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <p className="text-slate-300">
              Pagina {currentPage} de {totalPages} • {filteredMatches.length} jogos
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
              >
                Anterior
              </Button>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100">
                {currentPage}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              >
                Proxima
              </Button>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-white">
              Historico de palpites (jogos fechados)
            </h2>
            {predictionHistory.length === 0 ? (
              <Surface className="p-6 text-center">
                <p className="text-sm text-slate-300">
                  Seus palpites fechados aparecerao aqui conforme os jogos iniciarem.
                </p>
              </Surface>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {predictionHistory.map(({ match, prediction }) => (
                  <Surface key={`history-${match.id}`} className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge
                        tone={
                          isMatchFinished(match)
                            ? "game_finished"
                            : isPredictionLocked(match)
                              ? "bet_closed"
                              : "bet_open"
                        }
                      >
                        {isMatchFinished(match)
                          ? "Jogo finalizado"
                          : isPredictionLocked(match)
                            ? "Palpites fechados"
                            : "Palpites em aberto"}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {formatKickoffDate(match.kickoffAt)}
                      </span>
                    </div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-300">
                      {match.groupName ? `Grupo ${match.groupName}` : "Mata-mata"}
                      {typeof match.roundNumber === "number"
                        ? ` | Rodada ${match.roundNumber}`
                        : ""}
                    </p>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <TeamPill teamName={match.homeTeam} />
                      <span className="font-display text-2xl">
                        {prediction?.homeGoals ?? "-"} × {prediction?.awayGoals ?? "-"}
                      </span>
                      <TeamPill teamName={match.awayTeam} align="right" />
                    </div>
                  </Surface>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
