import "server-only";

import type { PoolClient } from "pg";
import { calculateQualificationBetPayouts } from "@/lib/qualification-bet-payout";
import { QUALIFICATION_BET_MIN_STAKE } from "@/lib/qualification-bet-types";
import type {
  QualificationBetHistoryItem,
  QualificationBetMatch,
  QualificationBetSide,
  QualificationBetSnapshot,
  QualificationBetStatus,
  QualificationBettor,
} from "@/lib/qualification-bet-types";
import { getPool } from "@/lib/match-prediction-report";
import type { MatchStage } from "@/lib/types";

const BETTING_WINDOW_MS = 30 * 60 * 1000;
const KNOCKOUT_STAGES: MatchStage[] = [
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "third_place",
  "final",
];

interface BalanceRow {
  total_points: number | string;
  prediction_points: number | string;
  bet_points: number | string;
  active_stakes: number | string;
}

interface MatchRow {
  id: string;
  stage: MatchStage;
  match_number: number | null;
  home_team: string;
  away_team: string;
  kickoff_at: string | Date;
  venue: string | null;
  is_closed: boolean;
  qualified_side: QualificationBetSide | null;
  bets_settled_at: string | Date | null;
}

interface BetRow {
  id: string;
  user_id: string;
  match_id: string;
  selected_side: QualificationBetSide;
  stake: number;
  status: QualificationBetStatus;
  payout: number;
  cancelled_at: string | Date | null;
  settled_at: string | Date | null;
  created_at: string | Date;
}

interface UserRow {
  id: string;
  display_name: string;
}

function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

function toOptionalIso(value: string | Date | null): string | null {
  return value ? toIso(value) : null;
}

function isKnockoutStage(stage: string): stage is MatchStage {
  return KNOCKOUT_STAGES.includes(stage as MatchStage);
}

function getDeadline(kickoffAt: string | Date): Date {
  return new Date(new Date(kickoffAt).getTime() - BETTING_WINDOW_MS);
}

function getNetPoints(bet: Pick<BetRow, "status" | "stake" | "payout">): number {
  if (bet.status === "active" || bet.status === "lost") {
    return -bet.stake;
  }
  if (bet.status === "won") {
    return bet.payout - bet.stake;
  }
  return 0;
}

async function getUserTable(client: PoolClient): Promise<"profiles" | "app_users"> {
  const result = await client.query<{
    profiles: string | null;
  }>("SELECT to_regclass('public.profiles')::text AS profiles");

  return result.rows[0]?.profiles ? "profiles" : "app_users";
}

async function getBalance(client: PoolClient, userId: string): Promise<BalanceRow> {
  const result = await client.query<BalanceRow>(
    `
      WITH prediction_total AS (
        SELECT coalesce(sum(
          CASE
            WHEN p.home_goals = m.home_score AND p.away_goals = m.away_score THEN 10
            WHEN (
              (
                (p.home_goals > p.away_goals AND m.home_score > m.away_score)
                OR (p.home_goals < p.away_goals AND m.home_score < m.away_score)
              )
              AND (p.home_goals - p.away_goals) = (m.home_score - m.away_score)
            ) THEN 7
            WHEN (
              (p.home_goals > p.away_goals AND m.home_score > m.away_score)
              OR (p.home_goals < p.away_goals AND m.home_score < m.away_score)
              OR (p.home_goals = p.away_goals AND m.home_score = m.away_score)
            ) THEN 5
            WHEN p.home_goals = m.home_score OR p.away_goals = m.away_score THEN 1
            ELSE 0
          END
        ), 0)::int AS prediction_points
        FROM public.predictions p
        JOIN public.matches m ON m.id = p.match_id
        WHERE p.user_id = $1
          AND m.home_score IS NOT NULL
          AND m.away_score IS NOT NULL
      ),
      bet_total AS (
        SELECT
          coalesce(sum(
            CASE
              WHEN status = 'active' THEN -stake
              WHEN status = 'lost' THEN -stake
              WHEN status = 'won' THEN payout - stake
              ELSE 0
            END
          ), 0)::int AS bet_points,
          coalesce(sum(CASE WHEN status = 'active' THEN stake ELSE 0 END), 0)::int
            AS active_stakes
        FROM public.qualification_bets
        WHERE user_id = $1
      )
      SELECT
        greatest(0, prediction_points + bet_points)::int AS total_points,
        prediction_points,
        bet_points,
        active_stakes
      FROM prediction_total
      CROSS JOIN bet_total
    `,
    [userId],
  );

  return (
    result.rows[0] ?? {
      total_points: 0,
      prediction_points: 0,
      bet_points: 0,
      active_stakes: 0,
    }
  );
}

function mapBettor(
  row: BetRow,
  displayName: string,
  totalPool: number,
): QualificationBettor {
  const stake = Number(row.stake);

  return {
    userId: row.user_id,
    displayName,
    selectedSide: row.selected_side,
    stake,
    status: row.status,
    payout: Number(row.payout),
    netPoints: getNetPoints(row),
    potSharePercentage: totalPool > 0 ? (stake / totalPool) * 100 : 0,
    createdAt: toIso(row.created_at),
  };
}

export async function getQualificationBetSnapshot(
  userId: string,
  now: Date = new Date(),
): Promise<QualificationBetSnapshot> {
  const pool = getPool();
  if (!pool) {
    throw new Error("Configure DATABASE_URL para usar as apostas.");
  }

  const client = await pool.connect();
  try {
    const userTable = await getUserTable(client);
    const [balance, matchesResult, betsResult, usersResult] = await Promise.all([
      getBalance(client, userId),
      client.query<MatchRow>(
        `
          SELECT
            id,
            stage,
            match_number,
            home_team,
            away_team,
            kickoff_at,
            venue,
            is_closed,
            qualified_side,
            bets_settled_at
          FROM public.matches
          WHERE stage = ANY($1::text[])
          ORDER BY kickoff_at ASC
        `,
        [KNOCKOUT_STAGES],
      ),
      client.query<BetRow>(
        `
          SELECT
            id,
            user_id,
            match_id,
            selected_side,
            stake,
            status,
            payout,
            cancelled_at,
            settled_at,
            created_at
          FROM public.qualification_bets
          ORDER BY created_at ASC
        `,
      ),
      client.query<UserRow>(
        `SELECT id, display_name FROM public.${userTable} ORDER BY display_name ASC`,
      ),
    ]);

    const displayNameByUser = new Map(
      usersResult.rows.map((user) => [user.id, user.display_name]),
    );
    const betsByMatch = new Map<string, BetRow[]>();
    for (const bet of betsResult.rows) {
      const current = betsByMatch.get(bet.match_id) ?? [];
      current.push(bet);
      betsByMatch.set(bet.match_id, current);
    }

    const matches: QualificationBetMatch[] = matchesResult.rows.map((match) => {
      const matchBets = (betsByMatch.get(match.id) ?? []).filter(
        (bet) => bet.status !== "cancelled",
      );
      const homePool = matchBets
        .filter((bet) => bet.selected_side === "home")
        .reduce((total, bet) => total + Number(bet.stake), 0);
      const awayPool = matchBets
        .filter((bet) => bet.selected_side === "away")
        .reduce((total, bet) => total + Number(bet.stake), 0);
      const totalPool = homePool + awayPool;
      const bettors = matchBets.map((bet) =>
        mapBettor(
          bet,
          displayNameByUser.get(bet.user_id) ?? "Participante",
          totalPool,
        ),
      );
      const deadline = getDeadline(match.kickoff_at);

      return {
        id: match.id,
        stage: match.stage,
        matchNumber: match.match_number,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        kickoffAt: toIso(match.kickoff_at),
        venue: match.venue,
        isClosed: match.is_closed,
        qualifiedSide: match.qualified_side,
        betsSettledAt: toOptionalIso(match.bets_settled_at),
        bettingDeadlineAt: deadline.toISOString(),
        bettingOpen:
          !match.is_closed &&
          !match.bets_settled_at &&
          now.getTime() < deadline.getTime(),
        homePool,
        awayPool,
        bettors,
        myBet:
          bettors.find((bettor) => bettor.userId === userId) ?? null,
      };
    });

    const matchById = new Map(matchesResult.rows.map((match) => [match.id, match]));
    const history: QualificationBetHistoryItem[] = betsResult.rows
      .filter((bet) => bet.user_id === userId && bet.status !== "active")
      .map((bet) => {
        const match = matchById.get(bet.match_id);
        return {
          betId: bet.id,
          matchId: bet.match_id,
          stage: match?.stage ?? "round_of_32",
          homeTeam: match?.home_team ?? "Time A",
          awayTeam: match?.away_team ?? "Time B",
          kickoffAt: match ? toIso(match.kickoff_at) : toIso(bet.created_at),
          selectedSide: bet.selected_side,
          stake: Number(bet.stake),
          status: bet.status,
          payout: Number(bet.payout),
          netPoints: getNetPoints(bet),
          qualifiedSide: match?.qualified_side ?? null,
          createdAt: toIso(bet.created_at),
          settledAt: toOptionalIso(bet.settled_at),
        };
      })
      .sort(
        (left, right) =>
          new Date(right.kickoffAt).getTime() - new Date(left.kickoffAt).getTime(),
      );

    return {
      balance: Number(balance.total_points),
      predictionPoints: Number(balance.prediction_points),
      betPoints: Number(balance.bet_points),
      activeStakes: Number(balance.active_stakes),
      matches,
      history,
      refreshedAt: now.toISOString(),
    };
  } finally {
    client.release();
  }
}

export async function placeQualificationBet(params: {
  userId: string;
  matchId: string;
  selectedSide: QualificationBetSide;
  stake: number;
  now?: Date;
}): Promise<void> {
  if (!params.userId || !params.matchId) {
    throw new Error("Usuario ou jogo invalido.");
  }
  if (params.selectedSide !== "home" && params.selectedSide !== "away") {
    throw new Error("Selecao da aposta invalida.");
  }
  if (
    !Number.isInteger(params.stake) ||
    params.stake < QUALIFICATION_BET_MIN_STAKE
  ) {
    throw new Error(
      `A aposta minima e de ${QUALIFICATION_BET_MIN_STAKE} pontos.`,
    );
  }

  const pool = getPool();
  if (!pool) {
    throw new Error("Configure DATABASE_URL para usar as apostas.");
  }

  const now = params.now ?? new Date();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [params.userId]);

    const matchResult = await client.query<MatchRow>(
      `
        SELECT
          id,
          stage,
          match_number,
          home_team,
          away_team,
          kickoff_at,
          venue,
          is_closed,
          qualified_side,
          bets_settled_at
        FROM public.matches
        WHERE id = $1
        FOR UPDATE
      `,
      [params.matchId],
    );
    const match = matchResult.rows[0];
    if (!match) {
      throw new Error("Jogo nao encontrado.");
    }
    if (!isKnockoutStage(match.stage)) {
      throw new Error("Apostas de classificacao so existem no mata-mata.");
    }
    if (
      match.is_closed ||
      match.bets_settled_at ||
      now.getTime() >= getDeadline(match.kickoff_at).getTime()
    ) {
      throw new Error("As apostas deste jogo ja estao fechadas.");
    }

    const existingResult = await client.query<BetRow>(
      `
        SELECT *
        FROM public.qualification_bets
        WHERE user_id = $1 AND match_id = $2
        FOR UPDATE
      `,
      [params.userId, params.matchId],
    );
    if (existingResult.rows[0]?.status === "active") {
      throw new Error("Cancele sua aposta atual antes de fazer outra.");
    }

    const balance = await getBalance(client, params.userId);
    if (params.stake > Number(balance.total_points)) {
      throw new Error("Saldo insuficiente para esta aposta.");
    }

    await client.query(
      `
        INSERT INTO public.qualification_bets (
          user_id,
          match_id,
          selected_side,
          stake,
          status,
          payout,
          cancelled_at,
          settled_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'active', 0, null, null, $5, $5)
        ON CONFLICT (user_id, match_id)
        DO UPDATE SET
          selected_side = excluded.selected_side,
          stake = excluded.stake,
          status = 'active',
          payout = 0,
          cancelled_at = null,
          settled_at = null,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        params.userId,
        params.matchId,
        params.selectedSide,
        params.stake,
        now.toISOString(),
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelQualificationBet(params: {
  userId: string;
  matchId: string;
  now?: Date;
}): Promise<void> {
  const pool = getPool();
  if (!pool) {
    throw new Error("Configure DATABASE_URL para usar as apostas.");
  }

  const now = params.now ?? new Date();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [params.userId]);

    const matchResult = await client.query<MatchRow>(
      "SELECT * FROM public.matches WHERE id = $1 FOR UPDATE",
      [params.matchId],
    );
    const match = matchResult.rows[0];
    if (!match) {
      throw new Error("Jogo nao encontrado.");
    }
    if (
      match.is_closed ||
      match.bets_settled_at ||
      now.getTime() >= getDeadline(match.kickoff_at).getTime()
    ) {
      throw new Error("O prazo para cancelar esta aposta terminou.");
    }

    const updateResult = await client.query(
      `
        UPDATE public.qualification_bets
        SET
          status = 'cancelled',
          payout = 0,
          cancelled_at = $1,
          settled_at = null
        WHERE user_id = $2
          AND match_id = $3
          AND status = 'active'
      `,
      [now.toISOString(), params.userId, params.matchId],
    );
    if ((updateResult.rowCount ?? 0) === 0) {
      throw new Error("Nenhuma aposta ativa encontrada para cancelar.");
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function settleQualificationBets(params: {
  matchId: string;
  qualifiedSide: QualificationBetSide;
  settledAt?: Date;
  force?: boolean;
}): Promise<boolean> {
  const pool = getPool();
  if (!pool) {
    throw new Error("Configure DATABASE_URL para liquidar as apostas.");
  }

  const settledAt = params.settledAt ?? new Date();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const matchResult = await client.query<MatchRow>(
      "SELECT * FROM public.matches WHERE id = $1 FOR UPDATE",
      [params.matchId],
    );
    const match = matchResult.rows[0];
    if (!match) {
      throw new Error("Jogo nao encontrado para liquidar apostas.");
    }
    if (!isKnockoutStage(match.stage)) {
      await client.query("COMMIT");
      return false;
    }
    if (match.bets_settled_at && !params.force) {
      await client.query("COMMIT");
      return false;
    }

    if (params.force) {
      await client.query(
        `
          UPDATE public.qualification_bets
          SET status = 'active', payout = 0, settled_at = null
          WHERE match_id = $1
            AND status IN ('won', 'lost', 'refunded')
        `,
        [params.matchId],
      );
    }

    const betsResult = await client.query<BetRow>(
      `
        SELECT *
        FROM public.qualification_bets
        WHERE match_id = $1
          AND status = 'active'
        ORDER BY created_at ASC, id ASC
        FOR UPDATE
      `,
      [params.matchId],
    );
    const payouts = calculateQualificationBetPayouts(
      betsResult.rows.map((bet) => ({
        id: bet.id,
        selectedSide: bet.selected_side,
        stake: Number(bet.stake),
        createdAt: toIso(bet.created_at),
      })),
      params.qualifiedSide,
    );

    for (const payout of payouts) {
      await client.query(
        `
          UPDATE public.qualification_bets
          SET status = $1, payout = $2, settled_at = $3
          WHERE id = $4
        `,
        [payout.status, payout.payout, settledAt.toISOString(), payout.id],
      );
    }

    await client.query(
      `
        UPDATE public.matches
        SET qualified_side = $1, bets_settled_at = $2
        WHERE id = $3
      `,
      [params.qualifiedSide, settledAt.toISOString(), params.matchId],
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reopenQualificationBets(matchId: string): Promise<void> {
  const pool = getPool();
  if (!pool) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE public.qualification_bets
        SET status = 'active', payout = 0, settled_at = null
        WHERE match_id = $1
          AND status IN ('won', 'lost', 'refunded')
      `,
      [matchId],
    );
    await client.query(
      `
        UPDATE public.matches
        SET qualified_side = null, bets_settled_at = null
        WHERE id = $1
      `,
      [matchId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
