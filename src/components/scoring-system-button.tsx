"use client";

import { useState } from "react";
import { FiInfo, FiX } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { getTeamInfoByName } from "@/lib/teams";

const examples = [
  {
    title: "Placar exato",
    finalScore: "2 x 1",
    prediction: "2 x 1",
    points: "10 pts",
    description: "Acertou vencedor, gols dos dois times e placar completo.",
    homeTeam: "Brasil",
    awayTeam: "Argentina",
  },
  {
    title: "Vencedor + diferenca",
    finalScore: "2 x 0",
    prediction: "3 x 1",
    points: "7 pts",
    description: "Acertou o vencedor e a mesma diferenca de gols.",
    homeTeam: "Mexico",
    awayTeam: "Africa do Sul",
  },
  {
    title: "Resultado",
    finalScore: "1 x 0",
    prediction: "2 x 0",
    points: "5 pts",
    description: "Acertou vencedor ou empate, mas sem placar exato.",
    homeTeam: "Espanha",
    awayTeam: "Alemanha",
  },
  {
    title: "Gol de um time",
    finalScore: "2 x 0",
    prediction: "2 x 2",
    points: "1 pt",
    description: "Errou o resultado, mas acertou os gols de uma selecao.",
    homeTeam: "Portugal",
    awayTeam: "Uruguai",
  },
  {
    title: "Sem acerto",
    finalScore: "2 x 0",
    prediction: "0 x 1",
    points: "0 pts",
    description: "Nao acertou placar, resultado, diferenca ou gols de um time.",
    homeTeam: "Franca",
    awayTeam: "Italia",
  },
];

function teamLabel(teamName: string): string {
  const team = getTeamInfoByName(teamName);
  return team ? `${team.flag} ${teamName}` : teamName;
}

export function ScoringSystemButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <FiInfo />
        Sistema de pontuacao
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scoring-system-title"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--wb-border)] bg-[var(--wb-surface)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="scoring-system-title"
                  className="font-display text-2xl uppercase tracking-[0.08em] text-white md:text-3xl"
                >
                  Sistema de pontuacao
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Cada palpite pontua pelo melhor criterio atingido.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10"
                aria-label="Fechar sistema de pontuacao"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {examples.map((example) => (
                <div
                  key={example.title}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">
                      {example.title}
                    </p>
                    <span className="rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-100">
                      {example.points}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-[1fr_auto_1fr] md:items-center">
                    <p>{teamLabel(example.homeTeam)}</p>
                    <p className="font-display text-2xl text-white">
                      {example.finalScore}
                    </p>
                    <p className="md:text-right">{teamLabel(example.awayTeam)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Palpite: {example.prediction} | {example.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
              <p>Empate correto sem placar exato vale 5 pts.</p>
              <p>Vencedor + diferenca vale 7 pts apenas quando existe vencedor.</p>
              <p>Sem palpite no jogo: 0 pts.</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
