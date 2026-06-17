import type {
  LeaderboardRow,
  Match,
  MatchOutcome,
  Prediction,
  Profile,
  ScoreBreakdown,
} from "@/lib/types";

export function getOutcome(homeGoals: number, awayGoals: number): MatchOutcome {
  if (homeGoals > awayGoals) {
    return "home";
  }
  if (awayGoals > homeGoals) {
    return "away";
  }
  return "draw";
}

export function isMatchFinished(match: Match): boolean {
  return match.homeScore !== null && match.awayScore !== null;
}

export function getPredictionDeadline(match: Match): Date {
  return new Date(new Date(match.kickoffAt).getTime() - 30 * 60 * 1000);
}

export function isPredictionLocked(
  match: Match,
  now: Date = new Date(),
): boolean {
  if (match.isClosed || match.predictionsClosedAt) {
    return true;
  }

  return getPredictionDeadline(match).getTime() <= now.getTime();
}

export function scorePrediction(
  prediction: Pick<Prediction, "homeGoals" | "awayGoals">,
  match: Pick<Match, "homeScore" | "awayScore">,
): ScoreBreakdown {
  if (match.homeScore === null || match.awayScore === null) {
    return {
      points: 0,
      exactScore: false,
      goalDiffHit: false,
      resultHit: false,
      oneTeamGoalsHit: false,
    };
  }

  const exactScore =
    prediction.homeGoals === match.homeScore &&
    prediction.awayGoals === match.awayScore;

  if (exactScore) {
    return {
      points: 10,
      exactScore: true,
      goalDiffHit: true,
      resultHit: true,
      oneTeamGoalsHit: true,
    };
  }

  const predictedOutcome = getOutcome(prediction.homeGoals, prediction.awayGoals);
  const actualOutcome = getOutcome(match.homeScore, match.awayScore);
  const sameGoalDiff =
    prediction.homeGoals - prediction.awayGoals === match.homeScore - match.awayScore;
  const resultHit = predictedOutcome === actualOutcome;

  // A regra de 7 pontos depende de vencedor + diferença de gols.
  // Em empates não há vencedor, então o acerto cai para 5 pontos.
  const goalDiffHit = resultHit && predictedOutcome !== "draw" && sameGoalDiff;

  if (goalDiffHit) {
    return {
      points: 7,
      exactScore: false,
      goalDiffHit: true,
      resultHit: true,
      oneTeamGoalsHit: false,
    };
  }

  if (resultHit) {
    return {
      points: 5,
      exactScore: false,
      goalDiffHit: false,
      resultHit: true,
      oneTeamGoalsHit: false,
    };
  }

  const oneTeamGoalsHit =
    prediction.homeGoals === match.homeScore || prediction.awayGoals === match.awayScore;

  if (oneTeamGoalsHit) {
    return {
      points: 1,
      exactScore: false,
      goalDiffHit: false,
      resultHit: false,
      oneTeamGoalsHit: true,
    };
  }

  return {
    points: 0,
    exactScore: false,
    goalDiffHit: false,
    resultHit: false,
    oneTeamGoalsHit: false,
  };
}

export function sortLeaderboard(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort((left, right) => {
    if (right.totalPoints !== left.totalPoints) {
      return right.totalPoints - left.totalPoints;
    }
    if (right.exactScores !== left.exactScores) {
      return right.exactScores - left.exactScores;
    }
    if (right.resultHits !== left.resultHits) {
      return right.resultHits - left.resultHits;
    }
    return left.displayName.localeCompare(right.displayName, "pt-BR");
  });
}

export function buildLeaderboard(
  profiles: Profile[],
  matches: Match[],
  predictions: Prediction[],
): LeaderboardRow[] {
  const finishedMatchMap = new Map(
    matches.filter(isMatchFinished).map((match) => [match.id, match]),
  );

  const rowsByUser = new Map<string, LeaderboardRow>();

  for (const profile of profiles) {
    rowsByUser.set(profile.id, {
      userId: profile.id,
      displayName: profile.displayName,
      totalPoints: 0,
      exactScores: 0,
      goalDiffHits: 0,
      resultHits: 0,
      oneTeamGoalHits: 0,
      predictionsCount: 0,
    });
  }

  for (const prediction of predictions) {
    const match = finishedMatchMap.get(prediction.matchId);
    if (!match) {
      continue;
    }

    if (!rowsByUser.has(prediction.userId)) {
      rowsByUser.set(prediction.userId, {
        userId: prediction.userId,
        displayName: "Participante",
        totalPoints: 0,
        exactScores: 0,
        goalDiffHits: 0,
        resultHits: 0,
        oneTeamGoalHits: 0,
        predictionsCount: 0,
      });
    }

    const row = rowsByUser.get(prediction.userId);
    if (!row) {
      continue;
    }

    const breakdown = scorePrediction(prediction, match);
    row.totalPoints += breakdown.points;
    row.exactScores += breakdown.exactScore ? 1 : 0;
    row.goalDiffHits += breakdown.goalDiffHit ? 1 : 0;
    row.resultHits += breakdown.resultHit ? 1 : 0;
    row.oneTeamGoalHits += breakdown.oneTeamGoalsHit ? 1 : 0;
    row.predictionsCount += 1;
  }

  return sortLeaderboard(Array.from(rowsByUser.values()));
}
