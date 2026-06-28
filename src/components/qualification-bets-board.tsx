"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiClock,
  FiRefreshCw,
  FiRotateCcw,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { TeamPill } from "@/components/team-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import type {
  QualificationBetHistoryItem,
  QualificationBetMatch,
  QualificationBetSide,
  QualificationBetSnapshot,
  QualificationBetStatus,
} from "@/lib/qualification-bet-types";
import { STAGE_LABEL } from "@/lib/match-ui";

type ViewMode = "open" | "history";

const STATUS_LABEL: Record<QualificationBetStatus, string> = {
  active: "Ativa",
  cancelled: "Cancelada",
  won: "Venceu",
  lost: "Perdeu",
  refunded: "Devolvida",
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function toPositiveInteger(value: string): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function getSelectedTeam(match: QualificationBetMatch, side: QualificationBetSide): string {
  return side === "home" ? match.homeTeam : match.awayTeam;
}

function estimateReturn(
  match: QualificationBetMatch,
  side: QualificationBetSide,
  stake: number,
): number {
  if (stake <= 0) {
    return 0;
  }

  const ownPool = (side === "home" ? match.homePool : match.awayPool) + stake;
  const opposingPool = side === "home" ? match.awayPool : match.homePool;
  if (opposingPool === 0) {
    return stake;
  }

  return stake + Math.floor((stake * opposingPool) / ownPool);
}

function BetHistoryTable({ history }: { history: QualificationBetHistoryItem[] }) {
  if (history.length === 0) {
    return (
      <Surface className="p-8 text-center">
        <p className="font-semibold">Nenhuma aposta encerrada ainda.</p>
        <p className="mt-1 text-sm text-[var(--wb-muted)]">
          Resultados, devolucoes e cancelamentos aparecerao aqui.
        </p>
      </Surface>
    );
  }

  return (
    <Surface className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--wb-border)] bg-[var(--wb-surface-alt)] text-left text-xs uppercase tracking-wide text-[var(--wb-muted)]">
              <th className="px-3 py-3 font-semibold">Jogo</th>
              <th className="px-3 py-3 font-semibold">Escolha</th>
              <th className="px-3 py-3 text-right font-semibold">Apostado</th>
              <th className="px-3 py-3 text-right font-semibold">Retorno</th>
              <th className="px-3 py-3 text-right font-semibold">Saldo</th>
              <th className="px-3 py-3 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--wb-border)]">
            {history.map((item) => (
              <tr key={item.betId}>
                <td className="px-3 py-3">
                  <p className="font-semibold">
                    {item.homeTeam} x {item.awayTeam}
                  </p>
                  <p className="text-xs text-[var(--wb-muted)]">
                    {STAGE_LABEL[item.stage]} | {formatDateTime(item.kickoffAt)}
                  </p>
                </td>
                <td className="px-3 py-3">
                  {item.selectedSide === "home" ? item.homeTeam : item.awayTeam}
                </td>
                <td className="px-3 py-3 text-right font-semibold">{item.stake}</td>
                <td className="px-3 py-3 text-right font-semibold">{item.payout}</td>
                <td
                  className={cn(
                    "px-3 py-3 text-right font-bold",
                    item.netPoints > 0
                      ? "text-[var(--wb-green)]"
                      : item.netPoints < 0
                        ? "text-[var(--wb-red)]"
                        : "text-[var(--wb-muted)]",
                  )}
                >
                  {item.netPoints > 0 ? "+" : ""}
                  {item.netPoints}
                </td>
                <td className="px-3 py-3 text-right">
                  <Badge
                    tone={
                      item.status === "won"
                        ? "finished"
                        : item.status === "lost"
                          ? "bet_closed"
                          : "neutral"
                    }
                  >
                    {STATUS_LABEL[item.status]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

export function QualificationBetsBoard() {
  const [snapshot, setSnapshot] = useState<QualificationBetSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingMatchId, setProcessingMatchId] = useState<string | null>(null);
  const [selectedSideByMatch, setSelectedSideByMatch] = useState<
    Record<string, QualificationBetSide>
  >({});
  const [stakeByMatch, setStakeByMatch] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("open");

  const loadSnapshot = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/qualification-bets", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        snapshot?: QualificationBetSnapshot;
      };
      if (!response.ok || !payload.ok || !payload.snapshot) {
        throw new Error(payload.error ?? "Falha ao carregar apostas.");
      }

      setSnapshot(payload.snapshot);
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Falha ao carregar apostas.",
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadSnapshot(true), 0);
    const interval = window.setInterval(() => void loadSnapshot(true), 5000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadSnapshot]);

  const visibleMatches = useMemo(
    () =>
      (snapshot?.matches ?? []).filter((match) => !match.betsSettledAt),
    [snapshot],
  );

  async function mutateBet(
    method: "POST" | "DELETE",
    body: Record<string, unknown>,
    matchId: string,
  ) {
    setProcessingMatchId(matchId);
    setError("");

    try {
      const response = await fetch("/api/qualification-bets", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        snapshot?: QualificationBetSnapshot;
      };
      if (!response.ok || !payload.ok || !payload.snapshot) {
        throw new Error(payload.error ?? "Falha ao processar aposta.");
      }

      setSnapshot(payload.snapshot);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Falha ao processar aposta.",
      );
    } finally {
      setProcessingMatchId(null);
    }
  }

  async function placeBet(match: QualificationBetMatch) {
    const selectedSide = selectedSideByMatch[match.id] ?? "home";
    const stake = toPositiveInteger(stakeByMatch[match.id] ?? "1");
    await mutateBet(
      "POST",
      {
        matchId: match.id,
        selectedSide,
        stake,
      },
      match.id,
    );
  }

  async function cancelBet(matchId: string) {
    await mutateBet("DELETE", { matchId }, matchId);
  }

  if (loading && !snapshot) {
    return (
      <Surface className="p-8 text-center">
        <p className="font-semibold">Carregando apostas...</p>
      </Surface>
    );
  }

  return (
    <section className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-[var(--wb-red)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Surface className="p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--wb-muted)]">
            Saldo disponivel
          </p>
          <p className="font-display text-4xl leading-none md:text-5xl">
            {snapshot?.balance ?? 0}
          </p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--wb-muted)]">
            Pontos de palpites
          </p>
          <p className="font-display text-4xl leading-none md:text-5xl">
            {snapshot?.predictionPoints ?? 0}
          </p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--wb-muted)]">
            Resultado em apostas
          </p>
          <p className="font-display text-4xl leading-none md:text-5xl">
            {(snapshot?.betPoints ?? 0) > 0 ? "+" : ""}
            {snapshot?.betPoints ?? 0}
          </p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--wb-muted)]">
            Pontos apostados
          </p>
          <p className="font-display text-4xl leading-none md:text-5xl">
            {snapshot?.activeStakes ?? 0}
          </p>
        </Surface>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[var(--wb-border)] bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("open")}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-semibold transition",
              viewMode === "open"
                ? "bg-[var(--wb-primary)] text-white"
                : "text-[var(--wb-muted)]",
            )}
          >
            Apostas abertas
          </button>
          <button
            type="button"
            onClick={() => setViewMode("history")}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-semibold transition",
              viewMode === "history"
                ? "bg-[var(--wb-primary)] text-white"
                : "text-[var(--wb-muted)]",
            )}
          >
            Historico
          </button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void loadSnapshot()}
        >
          <FiRefreshCw />
          Atualizar
        </Button>
      </div>

      {viewMode === "history" ? (
        <BetHistoryTable history={snapshot?.history ?? []} />
      ) : visibleMatches.length === 0 ? (
        <Surface className="p-8 text-center">
          <p className="font-semibold">Nenhum jogo eliminatorio disponivel.</p>
          <p className="mt-1 text-sm text-[var(--wb-muted)]">
            Os jogos aparecerao aqui quando forem importados da API.
          </p>
        </Surface>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleMatches.map((match) => {
            const selectedSide = selectedSideByMatch[match.id] ?? "home";
            const stake = toPositiveInteger(stakeByMatch[match.id] ?? "1");
            const estimatedReturn = estimateReturn(match, selectedSide, stake);
            const processing = processingMatchId === match.id;

            return (
              <Surface key={match.id} className="overflow-hidden p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Badge tone={match.bettingOpen ? "bet_open" : "bet_closed"}>
                      {match.bettingOpen
                        ? "Apostas abertas"
                        : match.isClosed
                          ? "Aguardando liquidacao"
                          : "Apostas fechadas"}
                    </Badge>
                    <p className="mt-2 text-xs uppercase tracking-wide text-[var(--wb-muted)]">
                      {STAGE_LABEL[match.stage]}
                      {match.matchNumber ? ` | Jogo ${match.matchNumber}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--wb-muted)]">
                    <p>{formatDateTime(match.kickoffAt)}</p>
                    <p className="inline-flex items-center gap-1">
                      <FiClock />
                      Fecha {formatDateTime(match.bettingDeadlineAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(["home", "away"] as const).map((side) => {
                    const pool = side === "home" ? match.homePool : match.awayPool;
                    const team = getSelectedTeam(match, side);
                    const selected = selectedSide === side;

                    return (
                      <button
                        key={side}
                        type="button"
                        disabled={!match.bettingOpen || Boolean(match.myBet)}
                        onClick={() =>
                          setSelectedSideByMatch((current) => ({
                            ...current,
                            [match.id]: side,
                          }))
                        }
                        className={cn(
                          "rounded-lg border p-3 text-left transition",
                          selected
                            ? "border-[var(--wb-primary)] bg-blue-50"
                            : "border-[var(--wb-border)] bg-white hover:bg-[var(--wb-surface-alt)]",
                          (!match.bettingOpen || match.myBet) &&
                            "cursor-default opacity-80",
                        )}
                      >
                        <TeamPill teamName={team} variant="feature" />
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-1 text-[var(--wb-muted)]">
                            <FiTrendingUp />
                            Pool
                          </span>
                          <strong>{pool} pts</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {match.myBet?.status === "active" ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--wb-muted)]">
                        Sua aposta
                      </p>
                      <p className="font-semibold">
                        {getSelectedTeam(match, match.myBet.selectedSide)} |{" "}
                        {match.myBet.stake} pontos
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={!match.bettingOpen || processing}
                      onClick={() => void cancelBet(match.id)}
                    >
                      <FiRotateCcw />
                      {processing ? "Cancelando..." : "Cancelar aposta"}
                    </Button>
                  </div>
                ) : match.bettingOpen ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-[var(--wb-muted)]">
                      Pontos para apostar
                      <Input
                        type="number"
                        min={1}
                        max={snapshot?.balance ?? 0}
                        value={stakeByMatch[match.id] ?? "1"}
                        onChange={(event) =>
                          setStakeByMatch((current) => ({
                            ...current,
                            [match.id]: event.target.value,
                          }))
                        }
                      />
                      <span className="block normal-case tracking-normal">
                        Retorno estimado agora: {estimatedReturn} pontos
                      </span>
                    </label>
                    <Button
                      type="button"
                      disabled={
                        processing ||
                        stake <= 0 ||
                        stake > (snapshot?.balance ?? 0)
                      }
                      onClick={() => void placeBet(match)}
                    >
                      {processing ? "Apostando..." : "Confirmar aposta"}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg border border-[var(--wb-border)] bg-[var(--wb-surface-alt)] p-3 text-sm text-[var(--wb-muted)]">
                    O prazo de aposta e cancelamento terminou.
                  </p>
                )}

                <div className="mt-4 overflow-hidden rounded-lg border border-[var(--wb-border)]">
                  <div className="flex items-center justify-between bg-[var(--wb-surface-alt)] px-3 py-2">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold">
                      <FiUsers />
                      Apostadores
                    </p>
                    <span className="text-xs text-[var(--wb-muted)]">
                      {match.bettors.length}
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {match.bettors.length === 0 ? (
                      <p className="px-3 py-4 text-center text-sm text-[var(--wb-muted)]">
                        Nenhuma aposta neste jogo.
                      </p>
                    ) : (
                      <div className="divide-y divide-[var(--wb-border)]">
                        {match.bettors.map((bettor) => (
                          <div
                            key={`${match.id}-${bettor.userId}`}
                            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-sm"
                          >
                            <span className="truncate font-semibold">
                              {bettor.displayName}
                            </span>
                            <span className="truncate text-[var(--wb-muted)]">
                              {getSelectedTeam(match, bettor.selectedSide)}
                            </span>
                            <strong>{bettor.stake}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Surface>
            );
          })}
        </div>
      )}
    </section>
  );
}
