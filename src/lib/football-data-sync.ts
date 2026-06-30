import "server-only";

import type { PoolClient } from "pg";
import { getFinishedScore } from "@/lib/football-data-score";
import { getPool, notifyFinishedMatchResult } from "@/lib/match-prediction-report";
import { settleQualificationBets } from "@/lib/qualification-bets";
import { getTeamInfoByCode, getTeamInfoByName } from "@/lib/teams";
import type { MatchStage } from "@/lib/types";

const PROVIDER = "football-data.org";
const DEFAULT_BASE_URL = "https://api.football-data.org/v4";
const DEFAULT_COMPETITION = "WC";
const DEFAULT_SEASON = "2026";
const MATCH_MAPPING_TOLERANCE_MS = 36 * 60 * 60 * 1000;
const MAX_MATCHES_PER_SYNC = 20;

const KNOCKOUT_STAGE_CONFIG: Record<
  string,
  { localStage: MatchStage; firstMatchNumber: number }
> = {
  LAST_32: { localStage: "round_of_32", firstMatchNumber: 73 },
  LAST_16: { localStage: "round_of_16", firstMatchNumber: 89 },
  QUARTER_FINALS: { localStage: "quarterfinal", firstMatchNumber: 97 },
  SEMI_FINALS: { localStage: "semifinal", firstMatchNumber: 101 },
  THIRD_PLACE: { localStage: "third_place", firstMatchNumber: 103 },
  FINAL: { localStage: "final", firstMatchNumber: 104 },
};

const STAGE_ALIASES: Record<string, string> = {
  ROUND_OF_32: "LAST_32",
  ROUND_OF_16: "LAST_16",
};

interface LocalMatchRow {
  id: string;
  match_number: number | null;
  home_team: string | null;
  away_team: string | null;
  kickoff_at: string;
  external_match_id: string | null;
  stage?: MatchStage;
  is_closed?: boolean;
  bets_settled_at?: string | null;
  result_score_basis?: string | null;
}

interface ExistingMatchIdentity {
  id: string;
  match_number: number | null;
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
  venue?: string | null;
  homeTeam?: FootballDataTeam | null;
  awayTeam?: FootballDataTeam | null;
  score?: {
    winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration?: string | null;
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

export interface ImportFootballDataMatchesResult {
  status: "not_configured" | "no_matches" | "processed" | "error";
  message: string;
  stage: string | null;
  received: number;
  inserted: number;
  updated: number;
  skipped: number;
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

function normalizeRequestedStage(stage: string | null | undefined): string | null {
  const normalized = stage?.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return STAGE_ALIASES[normalized] ?? normalized;
}

function getLocalTeamName(team: FootballDataTeam | null | undefined): string | null {
  if (!team) {
    return null;
  }

  const teamInfo =
    getTeamInfoByCode(team.tla) ??
    getTeamInfoByName(team.name) ??
    getTeamInfoByName(team.shortName);

  return teamInfo?.name ?? null;
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

function getKnockoutStageConfig(
  apiStage: string | null | undefined,
): { apiStage: string; localStage: MatchStage; firstMatchNumber: number } | null {
  const normalized = normalizeRequestedStage(apiStage);
  if (!normalized) {
    return null;
  }

  const config = KNOCKOUT_STAGE_CONFIG[normalized];
  return config ? { apiStage: normalized, ...config } : null;
}

function buildExternalMatchNumbers(apiMatches: FootballDataMatch[]): Map<number, number> {
  const numbers = new Map<number, number>();

  for (const [apiStage, config] of Object.entries(KNOCKOUT_STAGE_CONFIG)) {
    const stageMatches = apiMatches
      .filter((match) => normalizeRequestedStage(match.stage) === apiStage)
      .sort((left, right) => {
        const kickoffDiff =
          new Date(left.utcDate).getTime() - new Date(right.utcDate).getTime();
        return kickoffDiff !== 0 ? kickoffDiff : left.id - right.id;
      });

    stageMatches.forEach((match, index) => {
      numbers.set(match.id, config.firstMatchNumber + index);
    });
  }

  return numbers;
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

function getQualifiedSide(
  match: FootballDataMatch,
): "home" | "away" | null {
  if (match.score?.winner === "HOME_TEAM") {
    return "home";
  }
  if (match.score?.winner === "AWAY_TEAM") {
    return "away";
  }
  return null;
}

async function fetchCompetitionMatches(
  config: FootballDataConfig,
  stage?: string | null,
): Promise<FootballDataRequestResult<FootballDataMatchesResponse>> {
  return footballDataRequest<FootballDataMatchesResponse>(
    config,
    `/competitions/${config.competition}/matches`,
    { season: config.season, stage: normalizeRequestedStage(stage) },
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

export async function importFootballDataKnockoutMatches(
  stage?: string | null,
): Promise<ImportFootballDataMatchesResult> {
  const config = getConfig();
  const requestedStage = normalizeRequestedStage(stage);

  if (!config) {
    return {
      status: "not_configured",
      message: "Configure FOOTBALL_DATA_API_TOKEN para importar os jogos.",
      stage: requestedStage,
      received: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
  }

  if (requestedStage && !KNOCKOUT_STAGE_CONFIG[requestedStage]) {
    return {
      status: "error",
      message: `Fase ${requestedStage} nao suportada para importacao.`,
      stage: requestedStage,
      received: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [
        "Use LAST_32, LAST_16, QUARTER_FINALS, SEMI_FINALS, THIRD_PLACE ou FINAL.",
      ],
    };
  }

  const pool = getPool();
  if (!pool) {
    return {
      status: "not_configured",
      message: "Configure DATABASE_URL para importar os jogos.",
      stage: requestedStage,
      received: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
  }

  const response = await fetchCompetitionMatches(config, requestedStage);
  const apiMatches = (response.data.matches ?? []).filter((match) => {
    const stageConfig = getKnockoutStageConfig(match.stage);
    return Boolean(
      stageConfig && (!requestedStage || stageConfig.apiStage === requestedStage),
    );
  });

  if (apiMatches.length === 0) {
    return {
      status: "no_matches",
      message: requestedStage
        ? `A football-data.org ainda nao retornou jogos para ${requestedStage}.`
        : "A football-data.org ainda nao retornou jogos eliminatorios.",
      stage: requestedStage,
      received: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      requestsAvailable: response.requestsAvailable,
      requestCounterReset: response.requestCounterReset,
      errors: [],
    };
  }

  const matchNumbers = buildExternalMatchNumbers(apiMatches);
  const client = await pool.connect();

  try {
    const existingResult = await client.query<ExistingMatchIdentity>(
      `
        SELECT id, match_number, external_match_id
        FROM public.matches
        WHERE (
          external_provider = $1
          AND external_match_id IS NOT NULL
        )
        OR match_number BETWEEN 73 AND 104
      `,
      [PROVIDER],
    );
    const existingByExternalId = new Map(
      existingResult.rows
        .filter((match) => Boolean(match.external_match_id))
        .map((match) => [String(match.external_match_id), match]),
    );
    const existingByMatchNumber = new Map(
      existingResult.rows
        .filter((match) => typeof match.match_number === "number")
        .map((match) => [Number(match.match_number), match]),
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const checkedAt = new Date().toISOString();

    for (const apiMatch of apiMatches) {
      const stageConfig = getKnockoutStageConfig(apiMatch.stage);
      const homeTeam = getLocalTeamName(apiMatch.homeTeam);
      const awayTeam = getLocalTeamName(apiMatch.awayTeam);
      const matchNumber = matchNumbers.get(apiMatch.id) ?? null;
      const kickoffAt = new Date(apiMatch.utcDate);

      if (
        !stageConfig ||
        !homeTeam ||
        !awayTeam ||
        homeTeam === awayTeam ||
        Number.isNaN(kickoffAt.getTime())
      ) {
        skipped += 1;
        continue;
      }

      const externalMatchId = String(apiMatch.id);
      const existing =
        existingByExternalId.get(externalMatchId) ??
        (matchNumber ? existingByMatchNumber.get(matchNumber) : null);

      try {
        if (existing) {
          await client.query(
            `
              UPDATE public.matches
              SET
                stage = $1,
                group_name = null,
                match_number = coalesce(match_number, $2),
                round_number = null,
                home_team = $3,
                away_team = $4,
                kickoff_at = $5,
                venue = coalesce($6, venue),
                external_provider = $7,
                external_match_id = $8,
                external_mapping_checked_at = $9,
                live_status = $10
              WHERE id = $11
            `,
            [
              stageConfig.localStage,
              matchNumber,
              homeTeam,
              awayTeam,
              kickoffAt.toISOString(),
              apiMatch.venue?.trim() || null,
              PROVIDER,
              externalMatchId,
              checkedAt,
              apiMatch.status,
              existing.id,
            ],
          );
          existingByExternalId.set(externalMatchId, {
            ...existing,
            external_match_id: externalMatchId,
          });
          updated += 1;
          continue;
        }

        const insertResult = await client.query<ExistingMatchIdentity>(
          `
            INSERT INTO public.matches (
              stage,
              group_name,
              match_number,
              round_number,
              home_team,
              away_team,
              kickoff_at,
              is_closed,
              home_score,
              away_score,
              venue,
              external_provider,
              external_match_id,
              external_mapping_checked_at,
              live_status
            )
            VALUES (
              $1,
              null,
              $2,
              null,
              $3,
              $4,
              $5,
              false,
              null,
              null,
              $6,
              $7,
              $8,
              $9,
              $10
            )
            RETURNING id, match_number, external_match_id
          `,
          [
            stageConfig.localStage,
            matchNumber,
            homeTeam,
            awayTeam,
            kickoffAt.toISOString(),
            apiMatch.venue?.trim() || null,
            PROVIDER,
            externalMatchId,
            checkedAt,
            apiMatch.status,
          ],
        );
        const insertedMatch = insertResult.rows[0];
        if (insertedMatch) {
          existingByExternalId.set(externalMatchId, insertedMatch);
          if (typeof insertedMatch.match_number === "number") {
            existingByMatchNumber.set(insertedMatch.match_number, insertedMatch);
          }
        }
        inserted += 1;
      } catch (error) {
        errors.push(
          error instanceof Error
            ? `Jogo externo ${externalMatchId}: ${error.message}`
            : `Jogo externo ${externalMatchId}: falha ao importar.`,
        );
      }
    }

    const status =
      errors.length > 0 && inserted + updated === 0 ? "error" : "processed";

    return {
      status,
      message: `${inserted} jogo(s) inserido(s), ${updated} atualizado(s) e ${skipped} aguardando participantes.`,
      stage: requestedStage,
      received: apiMatches.length,
      inserted,
      updated,
      skipped,
      requestsAvailable: response.requestsAvailable,
      requestCounterReset: response.requestCounterReset,
      errors,
    };
  } finally {
    client.release();
  }
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
        SELECT
          id,
          match_number,
          home_team,
          away_team,
          kickoff_at,
          external_match_id,
          stage,
          is_closed,
          bets_settled_at,
          result_score_basis
        FROM public.matches
        WHERE external_provider = $1
          AND external_match_id IS NOT NULL
          AND (
            is_closed = false
            OR (
              stage <> 'group'
              AND (
                bets_settled_at IS NULL
                OR result_score_basis IS NULL
              )
            )
          )
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

      const qualifiedSide = getQualifiedSide(apiMatch);
      const updateResult = await client.query(
        `
          UPDATE public.matches
          SET
            home_score = $1,
            away_score = $2,
            is_closed = true,
            predictions_closed_at = coalesce(predictions_closed_at, $3),
            live_status = $4,
            result_synced_at = $3,
            qualified_side = coalesce($5, qualified_side),
            result_score_basis = 'regular_time'
          WHERE id = $6
        `,
        [
          finishedScore.home,
          finishedScore.away,
          now.toISOString(),
          apiMatch.status,
          qualifiedSide,
          localMatch.id,
        ],
      );

      if ((updateResult.rowCount ?? 0) === 0) {
        continue;
      }

      if (!localMatch.is_closed) {
        finalized += 1;
      }

      if (localMatch.stage !== "group") {
        if (qualifiedSide) {
          try {
            await settleQualificationBets({
              matchId: localMatch.id,
              qualifiedSide,
              settledAt: now,
            });
          } catch (error) {
            errors.push(
              error instanceof Error
                ? `Apostas ${localMatch.id}: ${error.message}`
                : `Apostas ${localMatch.id}: falha ao liquidar.`,
            );
          }
        } else {
          errors.push(
            `Apostas ${localMatch.id}: API finalizou sem informar HOME_TEAM/AWAY_TEAM.`,
          );
        }
      }

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
