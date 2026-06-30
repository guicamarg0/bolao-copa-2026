import { describe, expect, it } from "vitest";
import { buildLeaderboard, scorePrediction, sortLeaderboard } from "@/lib/scoring";
import type { LeaderboardRow, Match, Prediction, Profile } from "@/lib/types";

const finishedMatch: Match = {
  id: "m1",
  stage: "group",
  groupName: "A",
  homeTeam: "Brasil",
  awayTeam: "Canadá",
  kickoffAt: "2026-06-10T18:00:00.000Z",
  isClosed: true,
  homeScore: 2,
  awayScore: 1,
  venue: "Stadium",
};

describe("scorePrediction", () => {
  it("marca 10 pontos para placar exato", () => {
    const result = scorePrediction(
      { homeGoals: 2, awayGoals: 1 },
      { homeScore: 2, awayScore: 1 },
    );
    expect(result.points).toBe(10);
  });

  it("marca 7 pontos para vencedor e diferenca de gols", () => {
    const result = scorePrediction(
      { homeGoals: 3, awayGoals: 2 },
      { homeScore: 2, awayScore: 1 },
    );
    expect(result.points).toBe(7);
  });

  it("marca 5 pontos quando acerta apenas o resultado", () => {
    const result = scorePrediction(
      { homeGoals: 4, awayGoals: 2 },
      { homeScore: 2, awayScore: 1 },
    );
    expect(result.points).toBe(5);
  });

  it("marca 5 pontos para empate correto nao exato", () => {
    const result = scorePrediction(
      { homeGoals: 2, awayGoals: 2 },
      { homeScore: 1, awayScore: 1 },
    );
    expect(result.points).toBe(5);
  });

  it("marca 1 ponto quando erra o resultado, mas acerta gols de um time", () => {
    const result = scorePrediction(
      { homeGoals: 1, awayGoals: 2 },
      { homeScore: 1, awayScore: 0 },
    );
    expect(result.points).toBe(1);
  });

  it("marca 0 pontos quando erra tudo", () => {
    const result = scorePrediction(
      { homeGoals: 0, awayGoals: 3 },
      { homeScore: 2, awayScore: 1 },
    );
    expect(result.points).toBe(0);
  });
});

describe("buildLeaderboard", () => {
  it("ordena por pontos, exatos, acerto de resultado e nome", () => {
    const profiles: Profile[] = [
      {
        id: "u1",
        email: "ana@x.com",
        username: "ana",
        displayName: "Ana",
        isAdmin: false,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "u2",
        email: "bia@x.com",
        username: "bia",
        displayName: "Bia",
        isAdmin: false,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "u3",
        email: "cai@x.com",
        username: "cai",
        displayName: "Cai",
        isAdmin: false,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const matches: Match[] = [
      finishedMatch,
      {
        ...finishedMatch,
        id: "m2",
        homeScore: 1,
        awayScore: 1,
      },
    ];

    const predictions: Prediction[] = [
      {
        id: "p1",
        userId: "u1",
        matchId: "m1",
        homeGoals: 2,
        awayGoals: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "p2",
        userId: "u1",
        matchId: "m2",
        homeGoals: 1,
        awayGoals: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "p3",
        userId: "u2",
        matchId: "m1",
        homeGoals: 3,
        awayGoals: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "p4",
        userId: "u2",
        matchId: "m2",
        homeGoals: 2,
        awayGoals: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "p5",
        userId: "u3",
        matchId: "m1",
        homeGoals: 2,
        awayGoals: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "p6",
        userId: "u3",
        matchId: "m2",
        homeGoals: 0,
        awayGoals: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const leaderboard = buildLeaderboard(profiles, matches, predictions);
    expect(leaderboard.map((row) => row.userId)).toEqual(["u1", "u3", "u2"]);
    expect(leaderboard[0].totalPoints).toBe(20);
    expect(leaderboard[1].totalPoints).toBe(15);
    expect(leaderboard[2].totalPoints).toBe(12);
  });
});

describe("sortLeaderboard", () => {
  it("desempata por exatos, diferenca, resultado e saldo de apostas", () => {
    const base: LeaderboardRow = {
      userId: "base",
      displayName: "Base",
      totalPoints: 10,
      betPoints: 0,
      exactScores: 1,
      goalDiffHits: 1,
      resultHits: 2,
      oneTeamGoalHits: 0,
      predictionsCount: 1,
    };
    const rows: LeaderboardRow[] = [
      { ...base, userId: "bet-low", displayName: "Bet low", betPoints: -2 },
      { ...base, userId: "result", displayName: "Result", resultHits: 3 },
      { ...base, userId: "points", displayName: "Points", totalPoints: 11 },
      { ...base, userId: "difference", displayName: "Difference", goalDiffHits: 2 },
      { ...base, userId: "exact", displayName: "Exact", exactScores: 2 },
      { ...base, userId: "bet-high", displayName: "Bet high", betPoints: 5 },
    ];

    expect(sortLeaderboard(rows).map((row) => row.userId)).toEqual([
      "points",
      "exact",
      "difference",
      "result",
      "bet-high",
      "bet-low",
    ]);
  });
});
