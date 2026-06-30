import type { MatchStage } from "@/lib/types";

export const QUALIFICATION_BET_MIN_STAKE = 10;

export type QualificationBetSide = "home" | "away";
export type QualificationBetStatus =
  | "active"
  | "cancelled"
  | "won"
  | "lost"
  | "refunded";

export interface QualificationBettor {
  userId: string;
  displayName: string;
  selectedSide: QualificationBetSide;
  stake: number;
  status: QualificationBetStatus;
  payout: number;
  netPoints: number;
  potSharePercentage: number;
  createdAt: string;
}

export interface QualificationBetMatch {
  id: string;
  stage: MatchStage;
  matchNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string | null;
  isClosed: boolean;
  qualifiedSide: QualificationBetSide | null;
  betsSettledAt: string | null;
  bettingDeadlineAt: string;
  bettingOpen: boolean;
  homePool: number;
  awayPool: number;
  bettors: QualificationBettor[];
  myBet: QualificationBettor | null;
}

export interface QualificationBetHistoryItem {
  betId: string;
  matchId: string;
  stage: MatchStage;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  selectedSide: QualificationBetSide;
  stake: number;
  status: QualificationBetStatus;
  payout: number;
  netPoints: number;
  qualifiedSide: QualificationBetSide | null;
  createdAt: string;
  settledAt: string | null;
}

export interface QualificationBetSnapshot {
  balance: number;
  predictionPoints: number;
  betPoints: number;
  activeStakes: number;
  matches: QualificationBetMatch[];
  history: QualificationBetHistoryItem[];
  refreshedAt: string;
}
