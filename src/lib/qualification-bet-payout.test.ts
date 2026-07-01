import { describe, expect, it } from "vitest";
import { calculateQualificationBetPayouts } from "@/lib/qualification-bet-payout";

describe("calculateQualificationBetPayouts", () => {
  it("returns every stake when only one side has bets", () => {
    const result = calculateQualificationBetPayouts(
      [
        {
          id: "a",
          selectedSide: "home",
          stake: 10,
          createdAt: "2026-06-28T12:00:00.000Z",
        },
        {
          id: "b",
          selectedSide: "home",
          stake: 20,
          createdAt: "2026-06-28T12:01:00.000Z",
        },
      ],
      "away",
    );

    expect(result).toEqual([
      { id: "a", status: "refunded", payout: 10 },
      { id: "b", status: "refunded", payout: 20 },
    ]);
  });

  it("settles legacy bets below the current minimum", () => {
    const result = calculateQualificationBetPayouts(
      [
        {
          id: "legacy-home",
          selectedSide: "home",
          stake: 5,
          createdAt: "2026-06-28T12:00:00.000Z",
        },
        {
          id: "legacy-away",
          selectedSide: "away",
          stake: 5,
          createdAt: "2026-06-28T12:01:00.000Z",
        },
      ],
      "home",
    );

    expect(result).toEqual([
      { id: "legacy-home", status: "won", payout: 10 },
      { id: "legacy-away", status: "lost", payout: 0 },
    ]);
  });

  it("distributes the losing pool proportionally", () => {
    const result = calculateQualificationBetPayouts(
      [
        {
          id: "a",
          selectedSide: "home",
          stake: 20,
          createdAt: "2026-06-28T12:00:00.000Z",
        },
        {
          id: "b",
          selectedSide: "home",
          stake: 80,
          createdAt: "2026-06-28T12:01:00.000Z",
        },
        {
          id: "c",
          selectedSide: "away",
          stake: 60,
          createdAt: "2026-06-28T12:02:00.000Z",
        },
      ],
      "home",
    );

    expect(result).toEqual([
      { id: "a", status: "won", payout: 32 },
      { id: "b", status: "won", payout: 128 },
      { id: "c", status: "lost", payout: 0 },
    ]);
  });

  it("uses deterministic largest remainders without losing points", () => {
    const result = calculateQualificationBetPayouts(
      [
        {
          id: "a",
          selectedSide: "home",
          stake: 1,
          createdAt: "2026-06-28T12:00:00.000Z",
        },
        {
          id: "b",
          selectedSide: "home",
          stake: 1,
          createdAt: "2026-06-28T12:01:00.000Z",
        },
        {
          id: "c",
          selectedSide: "home",
          stake: 1,
          createdAt: "2026-06-28T12:02:00.000Z",
        },
        {
          id: "d",
          selectedSide: "away",
          stake: 2,
          createdAt: "2026-06-28T12:03:00.000Z",
        },
      ],
      "home",
    );

    expect(result).toEqual([
      { id: "a", status: "won", payout: 2 },
      { id: "b", status: "won", payout: 2 },
      { id: "c", status: "won", payout: 1 },
      { id: "d", status: "lost", payout: 0 },
    ]);
    expect(result.reduce((total, bet) => total + bet.payout, 0)).toBe(5);
  });
});
