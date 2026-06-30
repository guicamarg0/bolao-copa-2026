interface FootballDataScoreValue {
  home?: number | null;
  away?: number | null;
}

export function getFinishedScore(match: {
  status: string;
  score?: {
    fullTime?: FootballDataScoreValue;
    regularTime?: FootballDataScoreValue;
  };
}): { home: number; away: number } | null {
  if (match.status !== "FINISHED") {
    return null;
  }

  const regularTime = match.score?.regularTime;
  if (
    typeof regularTime?.home === "number" &&
    typeof regularTime.away === "number"
  ) {
    return { home: regularTime.home, away: regularTime.away };
  }

  const fullTime = match.score?.fullTime;
  if (
    typeof fullTime?.home === "number" &&
    typeof fullTime.away === "number"
  ) {
    return { home: fullTime.home, away: fullTime.away };
  }

  return null;
}
