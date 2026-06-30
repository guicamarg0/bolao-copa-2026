"use client";

import { useEffect, useState } from "react";
import { FiInfo, FiX } from "react-icons/fi";
import { TeamPill } from "@/components/team-pill";
import { Button } from "@/components/ui/button";

export function QualificationBettingInfoButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="icon"
        size="sm"
        className="w-9 px-0"
        onClick={() => setOpen(true)}
        aria-label="Como funcionam as apostas"
        title="Como funcionam as apostas"
      >
        <FiInfo aria-hidden="true" />
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qualification-betting-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--wb-border)] bg-white p-4 shadow-[0_24px_80px_rgba(7,29,73,0.24)] md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="qualification-betting-title"
                  className="font-display text-2xl uppercase text-[var(--wb-text)] md:text-3xl"
                >
                  Apostas de classificacao
                </h2>
                <p className="mt-1 text-sm text-[var(--wb-muted)]">
                  Use os pontos do ranking para apostar em quem avanca no mata-mata.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--wb-border)] bg-white text-[var(--wb-primary)] transition hover:bg-blue-50"
                aria-label="Fechar regras das apostas"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--wb-border)] bg-[var(--wb-surface-alt)] p-3">
                <p className="font-semibold text-[var(--wb-primary)]">Prazo e saldo</p>
                <p className="mt-1 text-sm text-[var(--wb-muted)]">
                  O valor sai do saldo ao confirmar. A aposta pode ser cancelada ou
                  refeita ate 30 minutos antes do jogo. A aposta minima e de 10 pontos.
                </p>
              </div>
              <div className="rounded-lg border border-[var(--wb-border)] bg-[var(--wb-surface-alt)] p-3">
                <p className="font-semibold text-[var(--wb-primary)]">Classificacao</p>
                <p className="mt-1 text-sm text-[var(--wb-muted)]">
                  Vale quem avanca, incluindo decisao na prorrogacao ou nos penaltis.
                  O palpite normal de placar continua separado.
                </p>
              </div>
              <div className="rounded-lg border border-[var(--wb-border)] bg-[var(--wb-surface-alt)] p-3">
                <p className="font-semibold text-[var(--wb-primary)]">Divisao do pote</p>
                <p className="mt-1 text-sm text-[var(--wb-muted)]">
                  Os vencedores recuperam a propria aposta e dividem o pote perdedor
                  proporcionalmente ao valor apostado.
                </p>
              </div>
              <div className="rounded-lg border border-[var(--wb-border)] bg-[var(--wb-surface-alt)] p-3">
                <p className="font-semibold text-[var(--wb-primary)]">Pote unilateral</p>
                <p className="mt-1 text-sm text-[var(--wb-muted)]">
                  Se somente uma selecao receber apostas, todos os valores sao
                  devolvidos e ninguem ganha ou perde pontos.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <TeamPill teamName="Brasil" />
                <span className="text-center font-display text-xl text-[var(--wb-primary)]">
                  classifica
                </span>
                <TeamPill teamName="Argentina" align="right" />
              </div>
              <p className="mt-3 text-sm text-[var(--wb-muted)]">
                Exemplo: o pote do Brasil tem 100 pts e o da Argentina 60 pts. Quem
                colocou 20 pts no Brasil representa 20% do pote vencedor e recebe 32
                pts: os 20 apostados mais 12 do pote perdedor.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
