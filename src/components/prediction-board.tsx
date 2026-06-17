"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiAward, FiCalendar, FiMapPin, FiMinus, FiPlus, FiSave, FiUsers } from "react-icons/fi";
import { TeamPill } from "@/components/team-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Surface } from "@/components/ui/surface";
import { ToastStack, type ToastItem, type ToastKind } from "@/components/ui/toast-stack";
import { STAGE_LABEL } from "@/lib/match-ui";
import { isMatchFinished, isPredictionLocked } from "@/lib/scoring";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Match, Prediction, Viewer } from "@/lib/types";

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

function formatKickoffDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
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

interface GoalControlProps {
  label: string;
  value: number;
  locked: boolean;
  align?: "left" | "right";
  onDecrease: () => void;
  onIncrease: () => void;
}

function GoalControl({
  label,
  value,
  locked,
  align = "left",
  onDecrease,
  onIncrease,
}: GoalControlProps) {
  return (
    <div className={align === "right" ? "md:text-right" : undefined}>
      <p className="mb-1 text-xs uppercase tracking-wide text-[var(--wb-muted)]">Gols</p>
      <div className="inline-flex h-10 w-full items-center overflow-hidden rounded-lg border border-[var(--wb-border)] bg-white sm:w-[210px]">
        <button
          type="button"
          disabled={locked}
          onClick={onDecrease}
          className="flex h-full w-12 items-center justify-center border-r border-[var(--wb-border)] text-2xl text-[var(--wb-primary)] transition hover:bg-blue-50 disabled:opacity-40"
          aria-label={`Diminuir gols de ${label}`}
        >
          <FiMinus />
        </button>
        <span className="flex-1 text-center font-display text-3xl leading-none text-[var(--wb-text)]">
          {value}
        </span>
        <button
          type="button"
          disabled={locked}
          onClick={onIncrease}
          className="flex h-full w-12 items-center justify-center border-l border-[var(--wb-border)] text-2xl text-[var(--wb-primary)] transition hover:bg-blue-50 disabled:opacity-40"
          aria-label={`Aumentar gols de ${label}`}
        >
          <FiPlus />
        </button>
      </div>
    </div>
  );
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
  const [groupFilter, setGroupFilter] = useState<"all" | string>("all");
  const [roundFilter, setRoundFilter] = useState<"all" | string>("all");
  const [page, setPage] = useState(1);

  const orderedMatches = useMemo(() => {
    return [...matches].sort(
      (left, right) =>
        new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(),
    );
  }, [matches]);

  const openOrderedMatches = useMemo(() => {
    return orderedMatches.filter(
      (match) => !isPredictionLocked(match) && !isMatchFinished(match),
    );
  }, [orderedMatches]);

  const filteredMatches = useMemo(() => {
    return openOrderedMatches.filter((match) => {
      if (groupFilter !== "all" && match.groupName !== groupFilter) {
        return false;
      }
      if (
        roundFilter !== "all" &&
        match.roundNumber !== Number.parseInt(roundFilter, 10)
      ) {
        return false;
      }

      return true;
    });
  }, [groupFilter, openOrderedMatches, roundFilter]);

  const groupOptions = useMemo(() => {
    const unique = new Set(
      openOrderedMatches
        .map((match) => match.groupName)
        .filter((group): group is string => Boolean(group)),
    );

    return Array.from(unique.values()).sort((left, right) =>
      left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" }),
    );
  }, [openOrderedMatches]);

  const roundOptions = useMemo(() => {
    const unique = new Set(
      openOrderedMatches
        .map((match) => match.roundNumber)
        .filter((round): round is number => Number.isInteger(round)),
    );

    return Array.from(unique.values()).sort((left, right) => left - right);
  }, [openOrderedMatches]);

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

  const openMatches = openOrderedMatches.length;
  const savedOpenPredictions = openOrderedMatches.filter(
    (match) => predictionsByMatch[match.id],
  ).length;
  const nextOpenMatch = openOrderedMatches[0] ?? null;

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
              <p className="text-xs uppercase tracking-wide text-slate-300">Palpites abertos salvos</p>
              <p className="font-display text-4xl leading-none md:text-5xl">
                {savedOpenPredictions}
              </p>
            </Surface>
            <Surface className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-300">Proximo jogo aberto</p>
              <p className="font-display text-xl leading-tight md:text-2xl">
                {nextOpenMatch ? formatKickoffDate(nextOpenMatch.kickoffAt) : "-"}
              </p>
            </Surface>
          </div>

          <div className="rounded-xl border border-[var(--wb-border)] bg-white p-4 shadow-[0_10px_24px_rgba(7,29,73,0.06)]">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
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

          <div className="grid gap-4 lg:grid-cols-2">
            {paginatedMatches.length === 0 ? (
              <Surface className="p-6 text-center lg:col-span-2">
                <p className="text-sm text-slate-300">
                  Nenhum jogo em aberto encontrado para o filtro selecionado.
                </p>
              </Surface>
            ) : (
              paginatedMatches.map((match, index) => {
                const finished = isMatchFinished(match);
                const locked = isPredictionLocked(match);
                const draft = drafts[match.id] ?? { homeGoals: "0", awayGoals: "0" };
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

                      <div className="relative z-10 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
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
                          <span className="rounded-lg border border-[var(--wb-border)] bg-white px-3 py-1 text-sm text-[var(--wb-muted)]">
                            {locked ? "Fechado" : "Aberto"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--wb-muted)]">
                          <span className="inline-flex items-center gap-1.5">
                            <FiCalendar className="text-base text-blue-200" />
                            {formatKickoffDate(match.kickoffAt)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <FiMapPin className="text-base text-blue-200" />
                            {match.venue ?? "Estadio a definir"}
                          </span>
                        </div>

                        <div className="h-px bg-white/12" />

                        <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
                          <div className="space-y-2">
                            <TeamPill teamName={match.homeTeam} variant="feature" />
                            <GoalControl
                              label={match.homeTeam}
                              value={homeGoals}
                              locked={locked}
                              onDecrease={() => adjustDraftValue(match.id, "homeGoals", -1)}
                              onIncrease={() => adjustDraftValue(match.id, "homeGoals", 1)}
                            />
                          </div>

                          <div className="flex flex-col items-center justify-center">
                            <span className="hidden h-10 w-px bg-[var(--wb-border)] md:block md:h-14" />
                            <span className="my-1 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--wb-primary)] bg-[var(--wb-primary)] font-display text-4xl leading-none text-white md:h-14 md:w-14">
                              VS
                            </span>
                            <span className="hidden h-10 w-px bg-[var(--wb-border)] md:block md:h-14" />
                          </div>

                          <div className="space-y-2">
                            <TeamPill
                              teamName={match.awayTeam}
                              variant="feature"
                              align="right"
                              className="justify-end"
                            />
                            <GoalControl
                              label={match.awayTeam}
                              value={awayGoals}
                              locked={locked}
                              align="right"
                              onDecrease={() => adjustDraftValue(match.id, "awayGoals", -1)}
                              onIncrease={() => adjustDraftValue(match.id, "awayGoals", 1)}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 border-t border-white/12 pt-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm text-[var(--wb-muted)]">
                            <span>{STAGE_LABEL[match.stage]}</span>
                            {match.groupName ? (
                              <span className="inline-flex items-center gap-1 pl-2">
                                <FiUsers className="text-sm text-blue-200" />
                                Grupo {match.groupName}
                              </span>
                            ) : null}
                            {typeof match.roundNumber === "number" ? (
                              <span className="inline-flex items-center gap-1 pl-2">
                                <FiAward className="text-sm text-blue-200" />
                                Rodada {match.roundNumber}
                              </span>
                            ) : null}
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            disabled={locked || savingMatchId === match.id}
                            onClick={() => void savePrediction(match)}
                            className="h-10 w-full px-4 text-base sm:w-auto"
                          >
                            <FiSave className="text-xl sm:text-base" />
                            {savingMatchId === match.id ? "Salvando..." : "Salvar palpite"}
                          </Button>
                        </div>
                      </div>
                    </Surface>
                  </motion.article>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <p className="text-slate-300">
              Pagina {currentPage} de {totalPages} | {filteredMatches.length} jogos em aberto
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
        </>
      ) : null}
    </section>
  );
}
