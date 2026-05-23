"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiAward, FiCalendar, FiMapPin, FiMinus, FiPlus, FiSave, FiUsers } from "react-icons/fi";
import { isMatchFinished, isPredictionLocked } from "@/lib/scoring";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { TeamPill } from "@/components/team-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
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

function toDisplayGoals(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
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

  function adjustDraftValue(matchId: string, field: keyof LocalDraft, delta: number) {
    const current = drafts[matchId];
    const currentValue = field === "homeGoals" ? current?.homeGoals : current?.awayGoals;
    const parsed = toDisplayGoals(currentValue);
    const next = Math.max(0, parsed + delta);
    setDraftValue(matchId, field, String(next));
  }

  function chooseOutcome(match: Match, outcome: MatchOutcome) {
    const current = drafts[match.id] ?? { homeGoals: "0", awayGoals: "0" };
    const home = toDisplayGoals(current.homeGoals);
    const away = toDisplayGoals(current.awayGoals);

    if (outcome === "draw") {
      const score = Math.max(home, away, 1);
      setDraftValue(match.id, "homeGoals", String(score));
      setDraftValue(match.id, "awayGoals", String(score));
      return;
    }

    if (outcome === "home") {
      const nextHome = Math.max(home, away + 1, 1);
      const nextAway = Math.min(away, nextHome - 1);
      setDraftValue(match.id, "homeGoals", String(nextHome));
      setDraftValue(match.id, "awayGoals", String(nextAway));
      return;
    }

    const nextAway = Math.max(away, home + 1, 1);
    const nextHome = Math.min(home, nextAway - 1);
    setDraftValue(match.id, "awayGoals", String(nextAway));
    setDraftValue(match.id, "homeGoals", String(nextHome));
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
          <div className="grid gap-3 sm:grid-cols-3">
            <Surface className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-300">Partidas abertas</p>
              <p className="font-display text-4xl leading-none md:text-5xl">{openMatches}</p>
            </Surface>
            <Surface className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-300">Partidas fechadas</p>
              <p className="font-display text-4xl leading-none md:text-5xl">{closedMatches}</p>
            </Surface>
            <Surface className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-300">Palpites salvos</p>
              <p className="font-display text-4xl leading-none md:text-5xl">
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
                  className="w-full md:w-auto"
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

          <div className="grid gap-4 xl:grid-cols-2">
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
                const draft = drafts[match.id] ?? { homeGoals: "0", awayGoals: "0" };
                const draftOutcome = outcomeFromDraft(draft);
                const homeGoals = toDisplayGoals(draft.homeGoals);
                const awayGoals = toDisplayGoals(draft.awayGoals);

                return (
                  <motion.article
                    key={match.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: index * 0.02 }}
                  >
                    <Surface className="relative overflow-hidden border-blue-300/35 p-4 md:p-5">
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(29,78,216,0.25),transparent_42%),radial-gradient(circle_at_85%_92%,rgba(29,78,216,0.18),transparent_42%)]" />
                      <div className="relative z-10 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
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

                            <span className="inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-blue-500/15 px-3 py-1 text-sm font-semibold text-slate-100">
                              <FiCalendar className="text-sm text-blue-200" />
                              {formatKickoffDate(match.kickoffAt)}
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

                          <p className="flex items-center gap-1 text-sm text-slate-300">
                            <FiMapPin className="text-sm text-slate-400" />
                            {match.venue ?? "Estadio a definir"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/12 bg-[linear-gradient(145deg,rgba(8,25,52,0.86),rgba(8,20,43,0.95))] p-3 md:p-4">
                          <div className="grid gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                              <TeamPill teamName={match.homeTeam} variant="feature" className="flex-1" />
                              <div className="w-full sm:w-auto">
                                <p className="mb-1 text-xs uppercase tracking-wide text-slate-300 sm:text-right">
                                  Gols
                                </p>
                                <div className="inline-flex h-12 w-full items-center overflow-hidden rounded-xl border border-blue-300/35 bg-[rgba(8,26,53,0.9)] sm:w-[220px]">
                                  <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => adjustDraftValue(match.id, "homeGoals", -1)}
                                    className="flex h-full w-14 items-center justify-center border-r border-white/10 text-2xl text-blue-300 transition hover:bg-white/5 disabled:opacity-40"
                                  >
                                    <FiMinus />
                                  </button>
                                  <span className="flex-1 text-center font-display text-4xl leading-none text-white">
                                    {homeGoals}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => adjustDraftValue(match.id, "homeGoals", 1)}
                                    className="flex h-full w-14 items-center justify-center border-l border-white/10 text-2xl text-blue-300 transition hover:bg-white/5 disabled:opacity-40"
                                  >
                                    <FiPlus />
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1">
                              <span className="h-[2px] w-full bg-[radial-gradient(circle,rgba(29,78,216,0.7)_1.2px,transparent_1.2px)] [background-size:12px_2px]" />
                              <span className="rounded-[1.2rem] border border-blue-300/40 bg-[linear-gradient(145deg,rgba(10,31,67,0.95),rgba(8,20,44,0.98))] px-5 py-2 font-display text-5xl leading-none text-white shadow-[0_12px_30px_rgba(10,24,47,0.45)]">
                                VS
                              </span>
                              <span className="h-[2px] w-full bg-[radial-gradient(circle,rgba(29,78,216,0.7)_1.2px,transparent_1.2px)] [background-size:12px_2px]" />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                              <TeamPill teamName={match.awayTeam} variant="feature" className="flex-1" />
                              <div className="w-full sm:w-auto">
                                <p className="mb-1 text-xs uppercase tracking-wide text-slate-300 sm:text-right">
                                  Gols
                                </p>
                                <div className="inline-flex h-12 w-full items-center overflow-hidden rounded-xl border border-blue-300/35 bg-[rgba(8,26,53,0.9)] sm:w-[220px]">
                                  <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => adjustDraftValue(match.id, "awayGoals", -1)}
                                    className="flex h-full w-14 items-center justify-center border-r border-white/10 text-2xl text-blue-300 transition hover:bg-white/5 disabled:opacity-40"
                                  >
                                    <FiMinus />
                                  </button>
                                  <span className="flex-1 text-center font-display text-4xl leading-none text-white">
                                    {awayGoals}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => adjustDraftValue(match.id, "awayGoals", 1)}
                                    className="flex h-full w-14 items-center justify-center border-l border-white/10 text-2xl text-blue-300 transition hover:bg-white/5 disabled:opacity-40"
                                  >
                                    <FiPlus />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-3">
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => chooseOutcome(match, "home")}
                            className={`rounded-xl border px-4 py-3 text-base font-semibold transition ${
                              draftOutcome === "home"
                                ? "border-blue-300/70 bg-blue-500/25 text-blue-100"
                                : "border-white/12 bg-white/5 text-slate-200 hover:bg-white/10"
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <FiAward className="text-lg text-blue-300" />
                              Vitoria {match.homeTeam}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => chooseOutcome(match, "draw")}
                            className={`rounded-xl border px-4 py-3 text-base font-semibold transition ${
                              draftOutcome === "draw"
                                ? "border-amber-300/75 bg-amber-500/22 text-amber-100"
                                : "border-white/12 bg-white/5 text-slate-200 hover:bg-white/10"
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <FiAward className="text-lg text-amber-300" />
                              Empate
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => chooseOutcome(match, "away")}
                            className={`rounded-xl border px-4 py-3 text-base font-semibold transition ${
                              draftOutcome === "away"
                                ? "border-green-300/70 bg-green-500/22 text-green-100"
                                : "border-white/12 bg-white/5 text-slate-200 hover:bg-white/10"
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <FiAward className="text-lg text-blue-300" />
                              Vitoria {match.awayTeam}
                            </span>
                          </button>
                        </div>

                        <Button
                          type="button"
                          size="lg"
                          disabled={locked || savingMatchId === match.id}
                          onClick={() => void savePrediction(match)}
                          className="h-14 w-full text-2xl"
                        >
                          <FiSave className="text-2xl" />
                          {savingMatchId === match.id ? "Salvando..." : "Salvar palpite"}
                        </Button>
                      </div>
                    </Surface>
                  </motion.article>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <p className="text-slate-300">
              Pagina {currentPage} de {totalPages} | {filteredMatches.length} jogos
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={currentPage <= 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
              >
                Anterior
              </Button>
              <div className="inline-flex min-w-[44px] items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100">
                {currentPage}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 sm:flex-none"
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
                    <div className="mb-2 flex items-center justify-between gap-2">
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
