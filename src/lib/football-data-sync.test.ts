import { describe, expect, it } from "vitest";
import { getFinishedScore } from "@/lib/football-data-score";

describe("getFinishedScore", () => {
  it("uses the score after 90 minutes when a knockout match goes to penalties", () => {
    expect(
      getFinishedScore({
        status: "FINISHED",
        score: {
          regularTime: { home: 1, away: 1 },
          fullTime: { home: 7, away: 6 },
        },
      }),
    ).toEqual({ home: 1, away: 1 });
  });

  it("falls back to full time for matches without a regularTime score", () => {
    expect(
      getFinishedScore({
        status: "FINISHED",
        score: {
          fullTime: { home: 2, away: 0 },
        },
      }),
    ).toEqual({ home: 2, away: 0 });
  });

  it("does not return a score before the match is finished", () => {
    expect(
      getFinishedScore({
        status: "IN_PLAY",
        score: {
          regularTime: { home: 1, away: 0 },
          fullTime: { home: 1, away: 0 },
        },
      }),
    ).toBeNull();
  });
});
