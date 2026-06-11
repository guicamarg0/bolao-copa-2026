"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MatchCard } from "@/components/match-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { STAGE_LABEL } from "@/lib/match-ui";
import { isMatchFinished, isPredictionLocked } from "@/lib/scoring";
import type { Match } from "@/lib/types";

type StatusFilter = "all" | "open" | "locked" | "finished";
const PAGE_SIZE = 6;

interface MatchesBoardProps {
  matches: Match[];
}

export function MatchesBoard({ matches }: MatchesBoardProps) {
  const [stage, setStage] = useState<"all" | Match["stage"]>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<"all" | string>("all");
  const [roundFilter, setRoundFilter] = useState<"all" | string>("all");
  const [page, setPage] = useState(1);

  const stageOptions = useMemo(() => {
    const unique = new Set(matches.map((match) => match.stage));
    return Array.from(unique.values());
  }, [matches]);

  const groupOptions = useMemo(() => {
    const unique = new Set(
      matches
        .map((match) => match.groupName)
        .filter((group): group is string => Boolean(group)),
    );

    return Array.from(unique.values()).sort((left, right) =>
      left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" }),
    );
  }, [matches]);

  const roundOptions = useMemo(() => {
    const unique = new Set(
      matches
        .map((match) => match.roundNumber)
        .filter((round): round is number => Number.isInteger(round)),
    );

    return Array.from(unique.values()).sort((left, right) => left - right);
  }, [matches]);

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      if (stage !== "all" && match.stage !== stage) {
        return false;
      }
      if (groupFilter !== "all" && match.groupName !== groupFilter) {
        return false;
      }
      if (
        roundFilter !== "all" &&
        match.roundNumber !== Number.parseInt(roundFilter, 10)
      ) {
        return false;
      }

      if (status === "finished") {
        return isMatchFinished(match);
      }
      if (status === "locked") {
        return !isMatchFinished(match) && isPredictionLocked(match, undefined, matches);
      }
      if (status === "open") {
        return !isMatchFinished(match) && !isPredictionLocked(match, undefined, matches);
      }

      return true;
    });
  }, [groupFilter, matches, roundFilter, stage, status]);

  const featuredMatches = useMemo(() => {
    const upcoming = filteredMatches
      .filter((match) => !isMatchFinished(match))
      .sort(
        (left, right) =>
          new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(),
      );

    return (upcoming.length > 0 ? upcoming : filteredMatches).slice(0, 2);
  }, [filteredMatches]);

  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedMatches = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredMatches.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredMatches]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Fase
            <Select
              value={stage}
              onChange={(event) => {
                setStage(event.target.value as typeof stage);
                setPage(1);
              }}
            >
              <option value="all">Todas as fases</option>
              {stageOptions.map((option) => (
                <option key={option} value={option}>
                  {STAGE_LABEL[option]}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Status
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="all">Todos</option>
              <option value="open">Palpites em aberto</option>
              <option value="locked">Palpites fechados</option>
              <option value="finished">Jogo finalizado</option>
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

          <div className="flex items-end">
            <Button
              variant="ghost"
              className="w-full md:w-auto"
              onClick={() => {
                setStage("all");
                setStatus("all");
                setGroupFilter("all");
                setRoundFilter("all");
                setPage(1);
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </div>
      </div>

      {featuredMatches.length > 0 ? (
        <div className="space-y-3">
          <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-[var(--wb-ice)]">
            Destaques da rodada
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {featuredMatches.map((match) => (
              <motion.div
                key={`featured-${match.id}`}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                <MatchCard match={match} matches={matches} featured />
              </motion.div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-[var(--wb-ice)]">
          Todos os jogos
        </h2>

        {filteredMatches.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-lg font-semibold text-slate-100">Nenhum jogo encontrado</p>
            <p className="mt-2 text-sm text-slate-300">
              Ajuste os filtros para visualizar partidas da Copa.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {paginatedMatches.map((match, index) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: index * 0.02 }}
                  className="h-full"
                >
                  <MatchCard match={match} matches={matches} />
                </motion.div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
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
                <motion.div
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 1 }}
                  className="inline-flex min-w-[44px] items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100"
                >
                  {currentPage}
                </motion.div>
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
          </div>
        )}
      </div>
    </section>
  );
}
