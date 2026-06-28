import type { QualificationBetSide } from "@/lib/qualification-bet-types";

export interface QualificationBetPayoutInput {
  id: string;
  selectedSide: QualificationBetSide;
  stake: number;
  createdAt: string;
}

export interface QualificationBetPayoutResult {
  id: string;
  status: "won" | "lost" | "refunded";
  payout: number;
}

export function calculateQualificationBetPayouts(
  bets: QualificationBetPayoutInput[],
  qualifiedSide: QualificationBetSide,
): QualificationBetPayoutResult[] {
  const homePool = bets
    .filter((bet) => bet.selectedSide === "home")
    .reduce((total, bet) => total + bet.stake, 0);
  const awayPool = bets
    .filter((bet) => bet.selectedSide === "away")
    .reduce((total, bet) => total + bet.stake, 0);

  if (homePool === 0 || awayPool === 0) {
    return bets.map((bet) => ({
      id: bet.id,
      status: "refunded",
      payout: bet.stake,
    }));
  }

  const winnerPool = qualifiedSide === "home" ? homePool : awayPool;
  const loserPool = qualifiedSide === "home" ? awayPool : homePool;
  const winners = bets
    .filter((bet) => bet.selectedSide === qualifiedSide)
    .map((bet) => {
      const numerator = bet.stake * loserPool;
      return {
        ...bet,
        baseProfit: Math.floor(numerator / winnerPool),
        remainder: numerator % winnerPool,
      };
    });
  const allocatedProfit = winners.reduce(
    (total, winner) => total + winner.baseProfit,
    0,
  );
  let remainingPoints = loserPool - allocatedProfit;
  const remainderOrder = [...winners].sort((left, right) => {
    if (right.remainder !== left.remainder) {
      return right.remainder - left.remainder;
    }

    const createdAtComparison = left.createdAt.localeCompare(right.createdAt);
    return createdAtComparison !== 0
      ? createdAtComparison
      : left.id.localeCompare(right.id);
  });
  const bonusById = new Map<string, number>();

  for (const winner of remainderOrder) {
    if (remainingPoints <= 0) {
      break;
    }
    bonusById.set(winner.id, 1);
    remainingPoints -= 1;
  }

  return bets.map((bet) => {
    if (bet.selectedSide !== qualifiedSide) {
      return {
        id: bet.id,
        status: "lost",
        payout: 0,
      };
    }

    const winner = winners.find((candidate) => candidate.id === bet.id);
    const profit = (winner?.baseProfit ?? 0) + (bonusById.get(bet.id) ?? 0);
    return {
      id: bet.id,
      status: "won",
      payout: bet.stake + profit,
    };
  });
}
