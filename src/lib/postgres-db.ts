import "server-only";

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import { buildLeaderboard, isPredictionLocked } from "@/lib/scoring";
import type {
  LeaderboardRow,
  Match,
  MatchStage,
  Prediction,
  Profile,
  Viewer,
} from "@/lib/types";

export const POSTGRES_SESSION_COOKIE_NAME = "bolao_local_session";

const SESSION_TTL_DAYS = 30;
const POSTGRES_SCHEMA_VERSION = 4;

declare global {
  var __bolaoPgPool: Pool | undefined;
  var __bolaoPgSchemaChecked: boolean | undefined;
  var __bolaoPgSchemaVersion: number | undefined;
}

interface PostgresUserRow {
  id: string;
  email: string;
  username: string | null;
  display_name: string;
  password_hash: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string | Date;
}

interface PostgresSessionRow {
  token: string;
  user_id: string;
  expires_at: string | Date;
}

interface PostgresMatchRow {
  id: string;
  stage: string;
  group_name: string | null;
  match_number: number | null;
  round_number: number | null;
  home_team: string;
  away_team: string;
  kickoff_at: string | Date;
  predictions_closed_at: string | Date | null;
  is_closed: boolean;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
}

interface PostgresPredictionRow {
  id: string;
  user_id: string;
  match_id: string;
  home_goals: number;
  away_goals: number;
  created_at: string | Date;
  updated_at: string | Date;
}

function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function isEmailLike(value: string): boolean {
  return value.includes("@");
}

function usernameToEmail(username: string): string {
  const normalized = normalizeUsername(username);
  const safe = normalized.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-");
  return `${safe || "user"}@bolao.local`;
}

function sanitizeUsername(value: string): string {
  const normalized = normalizeUsername(value);
  const safe = normalized.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe || "user";
}

function deriveUsername(displayName: string, email: string): string {
  const fromName = sanitizeUsername(displayName);
  if (fromName && fromName !== "user") {
    return fromName;
  }

  const fromEmail = sanitizeUsername(email.split("@")[0] ?? "");
  if (fromEmail && fromEmail !== "user") {
    return fromEmail;
  }

  return "user";
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }

  const expectedHashBuffer = Buffer.from(hash, "hex");
  const candidateHashBuffer = Buffer.from(
    scryptSync(password, salt, 64).toString("hex"),
    "hex",
  );

  if (expectedHashBuffer.length !== candidateHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedHashBuffer, candidateHashBuffer);
}

function mapUserToProfile(row: PostgresUserRow): Profile {
  const username = row.username
    ? sanitizeUsername(row.username)
    : deriveUsername(row.display_name, row.email);

  return {
    id: row.id,
    email: row.email,
    username,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    isActive: row.is_active,
    createdAt: toIso(row.created_at),
  };
}

function mapUserToViewer(row: PostgresUserRow): Viewer {
  const username = row.username
    ? sanitizeUsername(row.username)
    : deriveUsername(row.display_name, row.email);

  return {
    id: row.id,
    email: row.email,
    username,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    isActive: row.is_active,
    source: "postgres",
  };
}

function mapMatchRow(row: PostgresMatchRow): Match {
  return {
    id: row.id,
    stage: row.stage as MatchStage,
    groupName: row.group_name,
    matchNumber: row.match_number,
    roundNumber: row.round_number,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoffAt: toIso(row.kickoff_at),
    predictionsClosedAt: row.predictions_closed_at
      ? toIso(row.predictions_closed_at)
      : null,
    isClosed: row.is_closed,
    homeScore: row.home_score,
    awayScore: row.away_score,
    venue: row.venue,
  };
}

function mapPredictionRow(row: PostgresPredictionRow): Prediction {
  return {
    id: row.id,
    userId: row.user_id,
    matchId: row.match_id,
    homeGoals: row.home_goals,
    awayGoals: row.away_goals,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL nÃ£o configurada.");
  }

  if (!globalThis.__bolaoPgPool) {
    const sslEnabled =
      process.env.DATABASE_SSL?.trim().toLowerCase() === "true" ? true : false;

    globalThis.__bolaoPgPool = new Pool({
      connectionString,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    });
  }

  return globalThis.__bolaoPgPool;
}

async function ensureSchema() {
  if (globalThis.__bolaoPgSchemaVersion === POSTGRES_SCHEMA_VERSION) {
    return;
  }

  const pool = getPool();
  const result = await pool.query<{
    app_users: string | null;
    app_sessions: string | null;
    matches: string | null;
    predictions: string | null;
  }>(`
    SELECT
      to_regclass('public.app_users')::text AS app_users,
      to_regclass('public.app_sessions')::text AS app_sessions,
      to_regclass('public.matches')::text AS matches,
      to_regclass('public.predictions')::text AS predictions
  `);

  const row = result.rows[0];
  if (!row?.app_users || !row.app_sessions || !row.matches || !row.predictions) {
    throw new Error(
      "Schema PostgreSQL nÃ£o encontrado. Rode o SQL de setup em supabase/local-postgres.sql no DBeaver.",
    );
  }

  await pool.query("ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS username text");

  const usersResult = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    username: string | null;
  }>(
    `
      SELECT id, email, display_name, username
      FROM public.app_users
      WHERE username IS NULL OR BTRIM(username) = ''
    `,
  );

  for (const user of usersResult.rows) {
    const base = deriveUsername(user.display_name, user.email);
    let candidate = base;
    let suffix = 1;

    while (true) {
      const takenResult = await pool.query<{ id: string }>(
        `
          SELECT id
          FROM public.app_users
          WHERE LOWER(username) = LOWER($1) AND id <> $2
          LIMIT 1
        `,
        [candidate, user.id],
      );

      if (takenResult.rows.length === 0) {
        break;
      }

      suffix += 1;
      candidate = `${base}${suffix}`;
    }

    await pool.query(
      "UPDATE public.app_users SET username = $1, updated_at = $2 WHERE id = $3",
      [candidate, toIsoNow(), user.id],
    );
  }

  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_username_ci ON public.app_users ((LOWER(username)))",
  );

  await pool.query("ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_number integer");
  await pool.query("ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS round_number integer");
  await pool.query(
    "ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS predictions_closed_at timestamptz",
  );
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_match_number
    ON public.matches (match_number)
  `);

  globalThis.__bolaoPgSchemaVersion = POSTGRES_SCHEMA_VERSION;
  globalThis.__bolaoPgSchemaChecked = true;
}

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function getPostgresViewerBySessionToken(
  token: string | undefined,
): Promise<Viewer | null> {
  if (!token) {
    return null;
  }

  await ensureSchema();
  const pool = getPool();

  const sessionResult = await pool.query<PostgresSessionRow>(
    `
      SELECT token, user_id, expires_at
      FROM public.app_sessions
      WHERE token = $1
    `,
    [token],
  );

  const session = sessionResult.rows[0];
  if (!session) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await pool.query("DELETE FROM public.app_sessions WHERE token = $1", [token]);
    return null;
  }

  const userResult = await pool.query<PostgresUserRow>(
    `
      SELECT id, email, username, display_name, password_hash, is_admin, is_active, created_at
      FROM public.app_users
      WHERE id = $1
    `,
    [session.user_id],
  );

  const user = userResult.rows[0];
  if (!user || !user.is_active) {
    await pool.query("DELETE FROM public.app_sessions WHERE token = $1", [token]);
    return null;
  }

  return mapUserToViewer(user);
}

export async function createPostgresUser(params: {
  username: string;
  displayName: string;
  password: string;
}): Promise<Viewer> {
  const normalizedUsername = sanitizeUsername(params.username);
  const email = usernameToEmail(normalizedUsername);
  const password = params.password.trim();
  const displayName = params.displayName.trim();

  if (!normalizedUsername || !displayName || !password) {
    throw new Error("Informe nome, usuario e senha.");
  }

  await ensureSchema();
  const pool = getPool();

  const existingByUsernameResult = await pool.query<{ id: string }>(
    "SELECT id FROM public.app_users WHERE LOWER(username) = LOWER($1)",
    [normalizedUsername],
  );
  if (existingByUsernameResult.rows[0]) {
    throw new Error("Usuario ja cadastrado.");
  }

  const existingByEmailResult = await pool.query<{ id: string }>(
    "SELECT id FROM public.app_users WHERE email = $1",
    [email],
  );
  if (existingByEmailResult.rows[0]) {
    throw new Error("Usuario ja cadastrado.");
  }

  const adminCountResult = await pool.query<{ total: string }>(
    "SELECT COUNT(*)::text AS total FROM public.app_users WHERE is_admin = true AND is_active = true",
  );
  const isAdmin = Number(adminCountResult.rows[0]?.total ?? "0") === 0;

  const userId = randomUUID();
  const createdAt = toIsoNow();
  await pool.query(
    `
      INSERT INTO public.app_users (
        id,
        email,
        username,
        display_name,
        password_hash,
        is_admin,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, true, $7, $7)
    `,
    [
      userId,
      email,
      normalizedUsername,
      displayName,
      hashPassword(password),
      isAdmin,
      createdAt,
    ],
  );

  return {
    id: userId,
    email,
    username: normalizedUsername,
    displayName,
    isAdmin,
    isActive: true,
    source: "postgres",
  };
}

export async function authenticatePostgresUser(
  usernameInput: string,
  passwordInput: string,
): Promise<Viewer> {
  const normalizedInput = normalizeUsername(usernameInput);
  const normalizedUsername = sanitizeUsername(usernameInput);
  const password = passwordInput.trim();
  const syntheticEmail = usernameToEmail(normalizedUsername);

  if (!normalizedInput || !password) {
    throw new Error("Informe usuario e senha.");
  }

  await ensureSchema();
  const pool = getPool();

  const userResult = isEmailLike(normalizedInput)
    ? await pool.query<PostgresUserRow>(
        `
          SELECT id, email, username, display_name, password_hash, is_admin, is_active, created_at
          FROM public.app_users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
        `,
        [normalizedInput],
      )
    : await pool.query<PostgresUserRow>(
        `
          SELECT id, email, username, display_name, password_hash, is_admin, is_active, created_at
          FROM public.app_users
          WHERE LOWER(username) = LOWER($1)
             OR LOWER(email) = LOWER($2)
          LIMIT 1
        `,
        [normalizedUsername, syntheticEmail],
      );

  const user = userResult.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new Error("Usuario ou senha invalidos.");
  }
  if (!user.is_active) {
    throw new Error("Conta desativada. Contate um administrador.");
  }

  return mapUserToViewer(user);
}

export async function createPostgresSession(userId: string): Promise<string> {
  await ensureSchema();
  const pool = getPool();

  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `
      INSERT INTO public.app_sessions (token, user_id, expires_at, created_at)
      VALUES ($1, $2, $3, $4)
    `,
    [token, userId, expiresAt.toISOString(), now.toISOString()],
  );

  return token;
}

export async function deletePostgresSession(token: string | undefined): Promise<void> {
  if (!token) {
    return;
  }

  await ensureSchema();
  const pool = getPool();
  await pool.query("DELETE FROM public.app_sessions WHERE token = $1", [token]);
}

export async function getPostgresProfiles(): Promise<Profile[]> {
  await ensureSchema();
  const pool = getPool();
  const result = await pool.query<PostgresUserRow>(
    "SELECT id, email, username, display_name, password_hash, is_admin, is_active, created_at FROM public.app_users ORDER BY display_name ASC",
  );
  return result.rows.map(mapUserToProfile);
}

export async function getPostgresAccounts(): Promise<Profile[]> {
  return getPostgresProfiles();
}

export async function getPostgresMatches(): Promise<Match[]> {
  await ensureSchema();
  const pool = getPool();
  const result = await pool.query<PostgresMatchRow>(
    "SELECT * FROM public.matches ORDER BY kickoff_at ASC",
  );
  return result.rows.map(mapMatchRow);
}

export async function getPostgresPredictionsForUser(
  userId: string,
): Promise<Prediction[]> {
  if (!userId) {
    return [];
  }

  await ensureSchema();
  const pool = getPool();
  const result = await pool.query<PostgresPredictionRow>(
    `
      SELECT *
      FROM public.predictions
      WHERE user_id = $1
      ORDER BY created_at ASC
    `,
    [userId],
  );
  return result.rows.map(mapPredictionRow);
}

async function getPostgresAllPredictions(): Promise<Prediction[]> {
  await ensureSchema();
  const pool = getPool();
  const result = await pool.query<PostgresPredictionRow>("SELECT * FROM public.predictions");
  return result.rows.map(mapPredictionRow);
}

export async function getPostgresLeaderboard(): Promise<LeaderboardRow[]> {
  const [profiles, matches, predictions] = await Promise.all([
    getPostgresProfiles(),
    getPostgresMatches(),
    getPostgresAllPredictions(),
  ]);

  return buildLeaderboard(profiles, matches, predictions);
}

export async function upsertPostgresPrediction(params: {
  userId: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
}): Promise<Prediction> {
  const { userId, matchId, homeGoals, awayGoals } = params;

  if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals)) {
    throw new Error("Placar invÃ¡lido.");
  }
  if (homeGoals < 0 || awayGoals < 0) {
    throw new Error("Os gols nÃ£o podem ser negativos.");
  }

  await ensureSchema();
  const pool = getPool();

  const userResult = await pool.query<PostgresUserRow>(
    `
      SELECT id, email, username, display_name, password_hash, is_admin, is_active, created_at
      FROM public.app_users
      WHERE id = $1
    `,
    [userId],
  );
  const user = userResult.rows[0];
  if (!user || !user.is_active) {
    throw new Error("UsuÃ¡rio invÃ¡lido.");
  }

  const matchResult = await pool.query<PostgresMatchRow>(
    "SELECT * FROM public.matches WHERE id = $1",
    [matchId],
  );
  const matchRow = matchResult.rows[0];
  if (!matchRow) {
    throw new Error("Jogo nÃ£o encontrado.");
  }

  const match = mapMatchRow(matchRow);
  const dayMatchesResult = await pool.query<PostgresMatchRow>(
    `
      SELECT *
      FROM public.matches
      WHERE (kickoff_at AT TIME ZONE 'America/Sao_Paulo')::date =
        ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
    `,
    [match.kickoffAt],
  );
  if (isPredictionLocked(match, undefined, dayMatchesResult.rows.map(mapMatchRow))) {
    throw new Error("O jogo jÃ¡ estÃ¡ bloqueado para palpites.");
  }

  const existingPredictionResult = await pool.query<{
    id: string;
    created_at: string | Date;
  }>(
    `
      SELECT id, created_at
      FROM public.predictions
      WHERE user_id = $1 AND match_id = $2
    `,
    [userId, matchId],
  );

  const now = toIsoNow();
  const existing = existingPredictionResult.rows[0];

  if (existing) {
    await pool.query(
      `
        UPDATE public.predictions
        SET home_goals = $1, away_goals = $2, updated_at = $3
        WHERE id = $4
      `,
      [homeGoals, awayGoals, now, existing.id],
    );

    return {
      id: existing.id,
      userId,
      matchId,
      homeGoals,
      awayGoals,
      createdAt: toIso(existing.created_at),
      updatedAt: now,
    };
  }

  const predictionId = randomUUID();
  await pool.query(
    `
      INSERT INTO public.predictions (
        id,
        user_id,
        match_id,
        home_goals,
        away_goals,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6)
    `,
    [predictionId, userId, matchId, homeGoals, awayGoals, now],
  );

  return {
    id: predictionId,
    userId,
    matchId,
    homeGoals,
    awayGoals,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createPostgresMatch(params: {
  stage: MatchStage;
  groupName: string | null;
  matchNumber?: number | null;
  roundNumber?: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string | null;
}): Promise<void> {
  await ensureSchema();
  const pool = getPool();
  const now = toIsoNow();
  await pool.query(
    `
      INSERT INTO public.matches (
        id,
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
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NULL, NULL, $9, $10, $10)
    `,
    [
      randomUUID(),
      params.stage,
      params.groupName,
      params.matchNumber ?? null,
      params.roundNumber ?? null,
      params.homeTeam,
      params.awayTeam,
      params.kickoffAt,
      params.venue,
      now,
    ],
  );
}

export async function upsertPostgresMatchByNumber(params: {
  stage: MatchStage;
  groupName: string | null;
  matchNumber: number;
  roundNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string | null;
}): Promise<"inserted" | "updated"> {
  if (!Number.isInteger(params.matchNumber) || params.matchNumber <= 0) {
    throw new Error("Numero da partida invalido.");
  }
  if (
    params.roundNumber !== null &&
    (!Number.isInteger(params.roundNumber) || params.roundNumber <= 0)
  ) {
    throw new Error("Rodada invalida.");
  }

  await ensureSchema();
  const pool = getPool();
  const now = toIsoNow();

  const result = await pool.query<{ inserted: boolean }>(
    `
      INSERT INTO public.matches (
        id,
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
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NULL, NULL, $9, $10, $10)
      ON CONFLICT (match_number)
      DO UPDATE
      SET
        stage = EXCLUDED.stage,
        group_name = EXCLUDED.group_name,
        round_number = EXCLUDED.round_number,
        home_team = EXCLUDED.home_team,
        away_team = EXCLUDED.away_team,
        kickoff_at = EXCLUDED.kickoff_at,
        venue = EXCLUDED.venue,
        updated_at = EXCLUDED.updated_at
      RETURNING (xmax = 0) AS inserted
    `,
    [
      randomUUID(),
      params.stage,
      params.groupName,
      params.matchNumber,
      params.roundNumber,
      params.homeTeam,
      params.awayTeam,
      params.kickoffAt,
      params.venue,
      now,
    ],
  );

  return result.rows[0]?.inserted ? "inserted" : "updated";
}

export async function closePostgresMatch(
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    throw new Error("Placar invÃ¡lido.");
  }
  if (homeScore < 0 || awayScore < 0) {
    throw new Error("Placar invÃ¡lido.");
  }

  await ensureSchema();
  const pool = getPool();
  await pool.query(
    `
      UPDATE public.matches
      SET home_score = $1, away_score = $2, is_closed = true, updated_at = $3
      WHERE id = $4
    `,
    [homeScore, awayScore, toIsoNow(), matchId],
  );
}

export async function reopenPostgresMatch(matchId: string): Promise<void> {
  await ensureSchema();
  const pool = getPool();
  await pool.query(
    `
      UPDATE public.matches
      SET home_score = NULL, away_score = NULL, is_closed = false, updated_at = $1
      WHERE id = $2
    `,
    [toIsoNow(), matchId],
  );
}

export async function setPostgresUserAdmin(
  userId: string,
  makeAdmin: boolean,
): Promise<void> {
  await ensureSchema();
  const pool = getPool();

  const userResult = await pool.query<{
    id: string;
    is_admin: boolean;
  }>("SELECT id, is_admin FROM public.app_users WHERE id = $1", [userId]);
  const user = userResult.rows[0];
  if (!user) {
    throw new Error("UsuÃ¡rio nÃ£o encontrado.");
  }

  if (!makeAdmin && user.is_admin) {
    const adminCountResult = await pool.query<{ total: string }>(
      "SELECT COUNT(*)::text AS total FROM public.app_users WHERE is_admin = true",
    );
    if (Number(adminCountResult.rows[0]?.total ?? "0") <= 1) {
      throw new Error("NÃ£o Ã© possÃ­vel remover o Ãºltimo admin.");
    }
  }

  await pool.query(
    "UPDATE public.app_users SET is_admin = $1, updated_at = $2 WHERE id = $3",
    [makeAdmin, toIsoNow(), userId],
  );
}

export async function setPostgresUserActive(
  userId: string,
  makeActive: boolean,
): Promise<void> {
  await ensureSchema();
  const pool = getPool();

  const userResult = await pool.query<{
    id: string;
    is_admin: boolean;
    is_active: boolean;
  }>("SELECT id, is_admin, is_active FROM public.app_users WHERE id = $1", [userId]);
  const user = userResult.rows[0];
  if (!user) {
    throw new Error("UsuÃ¡rio nÃ£o encontrado.");
  }

  if (!makeActive && user.is_admin && user.is_active) {
    const activeAdminCountResult = await pool.query<{ total: string }>(
      "SELECT COUNT(*)::text AS total FROM public.app_users WHERE is_admin = true AND is_active = true",
    );
    if (Number(activeAdminCountResult.rows[0]?.total ?? "0") <= 1) {
      throw new Error("NÃ£o Ã© possÃ­vel desativar o Ãºltimo admin ativo.");
    }
  }

  await pool.query(
    "UPDATE public.app_users SET is_active = $1, updated_at = $2 WHERE id = $3",
    [makeActive, toIsoNow(), userId],
  );

  if (!makeActive) {
    await pool.query("DELETE FROM public.app_sessions WHERE user_id = $1", [userId]);
  }
}

export async function updatePostgresUserCredentials(
  userId: string,
  params: { username: string; password?: string },
): Promise<void> {
  const normalizedUsername = sanitizeUsername(params.username);
  const nextPassword = params.password?.trim();

  if (!normalizedUsername) {
    throw new Error("Informe um usuario valido.");
  }

  await ensureSchema();
  const pool = getPool();

  const userResult = await pool.query<{ id: string }>(
    "SELECT id FROM public.app_users WHERE id = $1",
    [userId],
  );
  if (!userResult.rows[0]) {
    throw new Error("Usuario nao encontrado.");
  }

  const usernameTakenResult = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM public.app_users
      WHERE LOWER(username) = LOWER($1)
        AND id <> $2
      LIMIT 1
    `,
    [normalizedUsername, userId],
  );
  if (usernameTakenResult.rows[0]) {
    throw new Error("Usuario ja esta em uso.");
  }

  const nextEmail = usernameToEmail(normalizedUsername);
  const emailTakenResult = await pool.query<{ id: string }>(
    "SELECT id FROM public.app_users WHERE email = $1 AND id <> $2 LIMIT 1",
    [nextEmail, userId],
  );
  if (emailTakenResult.rows[0]) {
    throw new Error("Nao foi possivel atualizar para este usuario.");
  }

  if (nextPassword) {
    if (nextPassword.length < 6) {
      throw new Error("A nova senha deve ter ao menos 6 caracteres.");
    }

    await pool.query(
      `
        UPDATE public.app_users
        SET username = $1, email = $2, password_hash = $3, updated_at = $4
        WHERE id = $5
      `,
      [
        normalizedUsername,
        nextEmail,
        hashPassword(nextPassword),
        toIsoNow(),
        userId,
      ],
    );
    return;
  }

  await pool.query(
    `
      UPDATE public.app_users
      SET username = $1, email = $2, updated_at = $3
      WHERE id = $4
    `,
    [normalizedUsername, nextEmail, toIsoNow(), userId],
  );
}




