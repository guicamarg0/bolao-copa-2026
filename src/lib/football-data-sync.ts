import "server-only";

import type { PoolClient } from "pg";
import { getPool, notifyFinishedMatchResult } from "@/lib/match-prediction-report";
import { getTeamInfoByName } from "@/lib/teams";

const PROVIDER = "football-data.org";
const DEFAULT_BASE_URL = "https://api.football-data.org/v4";
const DEFAULT_COMPETITION = "WC";
const DEFAULT_SEASON = "2026";
const MATCH_MAPPING_TOLERANCE_MS = 36 * 60 * 60 * 1000;
const MAX_MATCHES_PER_SYNC = 20;

interface LocalMatchRow {
  id: string;
  match_number: number | null;
  home_team: string | null;
  away_team: string | null;
  kickoff_at: string;
  external_match_id: string | null;
}

interface FootballDataTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number | null;
  stage?: string | null;
  group?: string | null;
  homeTeam?: FootballDataTeam | null;
  awayTeam?: FootballDataTeam | null;
  score?: {
    fullTime?: {
      home?: number | null;
      away?: number | null;
    };
    regularTime?: {
      home?: number | null;
      away?: number | null;
    };
  };
}

interface FootballDataMatchesResponse {
  matches?: FootballDataMatch[];
}

interface FootballDataRequestResult<T> {
  data: T;
  requestsAvailable: string | null;
  requestCounterReset: string | null;
}

interface FootballDataConfig {
  baseUrl: string;
  token: string;
  competition: string;
  season: string;
}

export interface SyncFootballDataResultsResult {
  status: "not_configured" | "no_matches" | "processed" | "error";
  message: string;
  mapped: number;
  checked: number;
  finalized: number;
  notified: number;
  requestsAvailable?: string | null;
  requestCounterReset?: string | null;
  errors: string[];
}

function getConfig(): FootballDataConfig | null {
  const token = process.env.FOOTBALL_DATA_API_TOKEN?.trim();
  if (!token) {
    return null;
  }

  return {
    baseUrl: process.env.FOOTBALL_DATA_BASE_URL?.trim() || DEFAULT_BASE_URL,
    token,
    competition: process.env.FOOTBALL_DATA_COMPETITION?.trim() || DEFAULT_COMPETITION,
    season: process.env.FOOTBALL_DATA_SEASON?.trim() || DEFAULT_SEASON,
  };
}

async function footballDataRequest<T>(
  config: FootballDataConfig,
  path: string,
  params: Record<string, string | number | null | undefined> = {},
  headers: Record<string, string> = {},
): Promise<FootballDataRequestResult<T>> {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(`${baseUrl}/${normalizedPath}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Auth-Token": config.token,
      ...headers,
    },
  });

  const text = await response.text();
  const payload = (text ? JSON.parse(text) : {}) as T & { message?: string };

  if (!response.ok) {
    throw new Error(payload.message ?? `football-data.org retornou HTTP ${response.status}.`);
  }

  return {
    data: payload,
    requestsAvailable: response.headers.get("X-RequestsAvailable"),
    requestCounterReset: response.headers.get("X-RequestCounter-Reset"),
  };
}

function getTeamCodeFromName(name: string | null | undefined): string | null {
  return getTeamInfoByName(name)?.code ?? null;
}

function getTeamCodeFromApiTeam(team: FootballDataTeam | null | undefined): string | null {
  if (!team) {
    return null;
  }

  if (team.tla?.trim()) {
    return team.tla.trim().toUpperCase();
  }

  return getTeamCodeFromName(team.name) ?? getTeamCodeFromName(team.shortName ?? "");
}

function isSameFixture(localMatch: LocalMatchRow, apiMatch: FootballDataMatch): boolean {
  const localHomeCode = getTeamCodeFromName(localMatch.home_team);
  const localAwayCode = getTeamCodeFromName(localMatch.away_team);
  const apiHomeCode = getTeamCodeFromApiTeam(apiMatch.homeTeam);
  const apiAwayCode = getTeamCodeFromApiTeam(apiMatch.awayTeam);

  if (!localHomeCode || !localAwayCode || !apiHomeCode || !apiAwayCode) {
    return false;
  }

  return localHomeCode === apiHomeCode && localAwayCode === apiAwayCode;
}

function getClosestApiMatch(
  localMatch: LocalMatchRow,
  apiMatches: FootballDataMatch[],
): FootballDataMatch | null {
  const candidates = apiMatches.filter((apiMatch) => isSameFixture(localMatch, apiMatch));
  if (candidates.length === 0) {
    return null;
  }

  const localKickoff = new Date(localMatch.kickoff_at).getTime();
  const ranked = candidates
    .map((apiMatch) => ({
      apiMatch,
      diff: Math.abs(new Date(apiMatch.utcDate).getTime() - localKickoff),
    }))
    .sort((left, right) => left.diff - right.diff);

  const closest = ranked[0];
  if (!closest || closest.diff > MATCH_MAPPING_TOLERANCE_MS) {
    return null;
  }

  return closest.apiMatch;
}

function getFinishedScore(match: FootballDataMatch): { home: number; away: number } | null {
  if (match.status !== "FINISHED") {
    return null;
  }

  const fullTime = match.score?.fullTime ?? match.score?.regularTime;
  const home = fullTime?.home;
  const away = fullTime?.away;
  if (typeof home !== "number" || typeof away !== "number") {
    return null;
  }

  return { home, away };
}

async function fetchCompetitionMatches(
  config: FootballDataConfig,
): Promise<FootballDataRequestResult<FootballDataMatchesResponse>> {
  return footballDataRequest<FootballDataMatchesResponse>(
    config,
    `/competitions/${config.competition}/matches`,
    { season: config.season },
  );
}

async function mapExternalMatches(
  client: PoolClient,
  config: FootballDataConfig,
): Promise<{
  mapped: number;
  requestsAvailable: string | null;
  requestCounterReset: string | null;
}> {
  const localMatchesResult = await client.query<LocalMatchRow>(
    `
      SELECT id, match_number, home_team, away_team, kickoff_at, external_match_id
      FROM public.matches
      WHERE external_match_id IS NULL
        AND (
          external_mapping_checked_at IS NULL
          OR external_mapping_checked_at < now() - interval '12 hours'
        )
      ORDER BY kickoff_at ASC
    `,
  );

  if (localMatchesResult.rows.length === 0) {
    return {
      mapped: 0,
      requestsAvailable: null,
      requestCounterReset: null,
    };
  }

  const response = await fetchCompetitionMatches(config);
  const apiMatches = response.data.matches ?? [];
  let mapped = 0;
  const checkedAt = new Date().toISOString();

  for (const localMatch of localMatchesResult.rows) {
    const apiMatch = getClosestApiMatch(localMatch, apiMatches);
    if (!apiMatch) {
      await client.query(
        `
          UPDATE public.matches
          SET
            external_provider = $1,
            external_mapping_checked_at = $2
          WHERE id = $3
            AND external_match_id IS NULL
        `,
        [PROVIDER, checkedAt, localMatch.id],
      );
      continue;
    }

    const updateResult = await client.query(
      `
        UPDATE public.matches
        SET
          external_provider = $1,
          external_match_id = $2,
          external_mapping_checked_at = $3,
          live_status = $4
        WHERE id = $5
          AND external_match_id IS NULL
      `,
      [PROVIDER, String(apiMatch.id), checkedAt, apiMatch.status, localMatch.id],
    );

    if ((updateResult.rowCount ?? 0) > 0) {
      mapped += 1;
    }
  }

  return {
    mapped,
    requestsAvailable: response.requestsAvailable,
    requestCounterReset: response.requestCounterReset,
  };
}

async function fetchMatchesByExternalIds(
  config: FootballDataConfig,
  externalIds: string[],
): Promise<FootballDataRequestResult<FootballDataMatchesResponse>> {
  return footballDataRequest<FootballDataMatchesResponse>(
    config,
    "/matches",
    { ids: externalIds.join(",") },
    { "X-Unfold-Goals": "true" },
  );
}

export async function syncFootballDataFinalResults(
  now: Date = new Date(),
): Promise<SyncFootballDataResultsResult> {
  const config = getConfig();
  if (!config) {
    return {
      status: "not_configured",
      message: "Configure FOOTBALL_DATA_API_TOKEN para sincronizar resultados.",
      mapped: 0,
      checked: 0,
      finalized: 0,
      notified: 0,
      errors: [],
    };
  }

  const pool = getPool();
  if (!pool) {
    return {
      status: "not_configured",
      message: "Configure DATABASE_URL para sincronizar resultados.",
      mapped: 0,
      checked: 0,
      finalized: 0,
      notified: 0,
      errors: [],
    };
  }

  const client = await pool.connect();
  try {
    const mapping = await mapExternalMatches(client, config);
    const candidatesResult = await client.query<LocalMatchRow>(
      `
        SELECT id, match_number, home_team, away_team, kickoff_at, external_match_id
        FROM public.matches
        WHERE external_provider = $1
          AND external_match_id IS NOT NULL
          AND is_closed = false
          AND kickoff_at <= $2
        ORDER BY kickoff_at ASC
        LIMIT ${MAX_MATCHES_PER_SYNC}
      `,
      [PROVIDER, now.toISOString()],
    );

    if (candidatesResult.rows.length === 0) {
      return {
        status: mapping.mapped > 0 ? "processed" : "no_matches",
        message:
          mapping.mapped > 0
            ? `${mapping.mapped} jogo(s) mapeado(s); nenhum resultado pendente.`
            : "Nenhum jogo pendente de resultado automatico.",
        mapped: mapping.mapped,
        checked: 0,
        finalized: 0,
        notified: 0,
        requestsAvailable: mapping.requestsAvailable,
        requestCounterReset: mapping.requestCounterReset,
        errors: [],
      };
    }

    const externalIds = candidatesResult.rows
      .map((match) => match.external_match_id)
      .filter((externalId): externalId is string => Boolean(externalId));
    const response = await fetchMatchesByExternalIds(config, externalIds);
    const apiMatchesById = new Map(
      (response.data.matches ?? []).map((match) => [String(match.id), match]),
    );

    let finalized = 0;
    let notified = 0;
    const errors: string[] = [];

    for (const localMatch of candidatesResult.rows) {
      if (!localMatch.external_match_id) {
        continue;
      }

      const apiMatch = apiMatchesById.get(localMatch.external_match_id);
      if (!apiMatch) {
        errors.push(`Jogo local ${localMatch.id}: API nao retornou match externo.`);
        continue;
      }

      const finishedScore = getFinishedScore(apiMatch);
      if (!finishedScore) {
        await client.query(
          `
            UPDATE public.matches
            SET live_status = $1
            WHERE id = $2
          `,
          [apiMatch.status, localMatch.id],
        );
        continue;
      }

      const updateResult = await client.query(
        `
          UPDATE public.matches
          SET
            home_score = $1,
            away_score = $2,
            is_closed = true,
            predictions_closed_at = coalesce(predictions_closed_at, $3),
            live_status = $4,
            result_synced_at = $3
          WHERE id = $5
            AND is_closed = false
        `,
        [
          finishedScore.home,
          finishedScore.away,
          now.toISOString(),
          apiMatch.status,
          localMatch.id,
        ],
      );

      if ((updateResult.rowCount ?? 0) === 0) {
        continue;
      }

      finalized += 1;
      try {
        const telegramMessageId = await notifyFinishedMatchResult({
          matchId: localMatch.id,
          homeScore: finishedScore.home,
          awayScore: finishedScore.away,
        });
        if (telegramMessageId) {
          notified += 1;
        }
      } catch (error) {
        errors.push(
          error instanceof Error
            ? `Telegram ${localMatch.id}: ${error.message}`
            : `Telegram ${localMatch.id}: erro ao enviar notificacao.`,
        );
      }
    }

    return {
      status: errors.length > 0 ? "error" : "processed",
      message: `${candidatesResult.rows.length} jogo(s) checado(s), ${finalized} finalizado(s).`,
      mapped: mapping.mapped,
      checked: candidatesResult.rows.length,
      finalized,
      notified,
      requestsAvailable: response.requestsAvailable ?? mapping.requestsAvailable,
      requestCounterReset: response.requestCounterReset ?? mapping.requestCounterReset,
      errors,
    };
  } finally {
    client.release();
  }
}
