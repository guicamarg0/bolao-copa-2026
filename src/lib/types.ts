export type MatchOutcome = "home" | "away" | "draw";

export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "third_place"
  | "final";

export interface Profile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Viewer {
  id: string;
  email: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  isActive: boolean;
  source: "supabase" | "local" | "postgres";
}

export interface Account {
  id: string;
  email: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Match {
  id: string;
  stage: MatchStage;
  groupName: string | null;
  matchNumber?: number | null;
  roundNumber?: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  predictionsClosedAt?: string | null;
  qualifiedSide?: "home" | "away" | null;
  betsSettledAt?: string | null;
  isClosed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScoreBreakdown {
  points: number;
  exactScore: boolean;
  goalDiffHit: boolean;
  resultHit: boolean;
  oneTeamGoalsHit: boolean;
}

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  totalPoints: number;
  betPoints: number;
  exactScores: number;
  goalDiffHits: number;
  resultHits: number;
  oneTeamGoalHits: number;
  predictionsCount: number;
}

export interface DashboardSummary {
  totalMatches: number;
  finishedMatches: number;
  upcomingMatches: Match[];
  topParticipants: LeaderboardRow[];
}
