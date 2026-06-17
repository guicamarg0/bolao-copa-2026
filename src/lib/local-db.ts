import "server-only";

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  FIXTURE_DEFAULT_PASSWORD,
  FIXTURE_MATCHES,
  FIXTURE_PREDICTIONS,
  FIXTURE_PROFILES,
} from "@/lib/fixtures";
import { buildLeaderboard, isPredictionLocked } from "@/lib/scoring";
import type {
  LeaderboardRow,
  Match,
  MatchStage,
  Prediction,
  Profile,
  Viewer,
} from "@/lib/types";

export const LOCAL_SESSION_COOKIE_NAME = "bolao_local_session";

const LOCAL_DB_PATH = path.join(process.cwd(), "supabase", "local.sqlite");
const SESSION_TTL_DAYS = 30;
const LOCAL_SCHEMA_VERSION = 5;

declare global {
  var __bolaoLocalDb: DatabaseSync | undefined;
  var __bolaoLocalDbSchemaVersion: number | undefined;
}

interface LocalUserRow {
  id: string;
  email: string;
  username: string | null;
  display_name: string;
  password_hash: string;
  is_admin: number;
  is_active: number;
  created_at: string;
}

interface LocalSessionRow {
  token: string;
  user_id: string;
  expires_at: string;
}

interface LocalMatchRow {
  id: string;
  stage: string;
  group_name: string | null;
  match_number: number | null;
  round_number: number | null;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  predictions_closed_at: string | null;
  prediction_warning_sent_at?: string | null;
  external_provider?: string | null;
  external_match_id?: string | null;
  external_mapping_checked_at?: string | null;
  live_status?: string | null;
  result_synced_at?: string | null;
  result_notified_at?: string | null;
  is_closed: number;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
}

interface LocalPredictionRow {
  id: string;
  user_id: string;
  match_id: string;
  home_goals: number;
  away_goals: number;
  created_at: string;
  updated_at: string;
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function sanitizeUsername(value: string): string {
  const normalized = normalizeUsername(value);
  const safe = normalized.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe || "user";
}

function isEmailLike(value: string): boolean {
  return value.includes("@");
}

function usernameToEmail(username: string): string {
  return `${sanitizeUsername(username)}@bolao.local`;
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

function mapUserToProfile(row: LocalUserRow): Profile {
  const username = row.username ? sanitizeUsername(row.username) : deriveUsername(row.display_name, row.email);
  return {
    id: row.id,
    email: row.email,
    username,
    displayName: row.display_name,
    isAdmin: row.is_admin === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

function mapMatchRow(row: LocalMatchRow): Match {
  return {
    id: row.id,
    stage: row.stage as MatchStage,
    groupName: row.group_name,
    matchNumber: row.match_number,
    roundNumber: row.round_number,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoffAt: row.kickoff_at,
    predictionsClosedAt: row.predictions_closed_at,
    isClosed: row.is_closed === 1,
    homeScore: row.home_score,
    awayScore: row.away_score,
    venue: row.venue,
  };
}

function mapPredictionRow(row: LocalPredictionRow): Prediction {
  return {
    id: row.id,
    userId: row.user_id,
    matchId: row.match_id,
    homeGoals: row.home_goals,
    awayGoals: row.away_goals,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function initializeSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS local_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_matches (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL,
      group_name TEXT,
      match_number INTEGER UNIQUE,
      round_number INTEGER,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      kickoff_at TEXT NOT NULL,
      predictions_closed_at TEXT,
      prediction_warning_sent_at TEXT,
      external_provider TEXT,
      external_match_id TEXT,
      external_mapping_checked_at TEXT,
      live_status TEXT,
      result_synced_at TEXT,
      result_notified_at TEXT,
      is_closed INTEGER NOT NULL DEFAULT 0,
      home_score INTEGER,
      away_score INTEGER,
      venue TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      check (home_score is null or home_score >= 0),
      check (away_score is null or away_score >= 0),
      check (match_number is null or match_number > 0),
      check (round_number is null or round_number > 0)
    );

    CREATE TABLE IF NOT EXISTS local_predictions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
      match_id TEXT NOT NULL REFERENCES local_matches(id) ON DELETE CASCADE,
      home_goals INTEGER NOT NULL,
      away_goals INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, match_id)
    );
  `);

  const columns = db.prepare("PRAGMA table_info(local_users)").all() as Array<{
    name: string;
  }>;
  const hasIsActive = columns.some((column) => column.name === "is_active");
  if (!hasIsActive) {
    db.exec(
      "ALTER TABLE local_users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
    );
  }

  const hasUsername = columns.some((column) => column.name === "username");
  if (!hasUsername) {
    db.exec("ALTER TABLE local_users ADD COLUMN username TEXT");
  }

  const usersWithoutUsername = db
    .prepare(
      "SELECT id, email, display_name, username FROM local_users WHERE username IS NULL OR TRIM(username) = ''",
    )
    .all() as Array<{
    id: string;
    email: string;
    display_name: string;
    username: string | null;
  }>;

  for (const user of usersWithoutUsername) {
    let candidate = deriveUsername(user.display_name, user.email);
    let suffix = 1;

    while (true) {
      const taken = db
        .prepare(
          "SELECT id FROM local_users WHERE LOWER(username) = LOWER(?) AND id <> ? LIMIT 1",
        )
        .get(candidate, user.id) as { id: string } | undefined;

      if (!taken) {
        break;
      }

      suffix += 1;
      candidate = `${deriveUsername(user.display_name, user.email)}${suffix}`;
    }

    db.prepare("UPDATE local_users SET username = ? WHERE id = ?").run(
      candidate,
      user.id,
    );
  }

  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_local_users_username_ci ON local_users(LOWER(username))",
  );

  const matchColumns = db.prepare("PRAGMA table_info(local_matches)").all() as Array<{
    name: string;
  }>;
  const hasMatchNumber = matchColumns.some((column) => column.name === "match_number");
  if (!hasMatchNumber) {
    db.exec("ALTER TABLE local_matches ADD COLUMN match_number INTEGER");
  }
  const hasRoundNumber = matchColumns.some((column) => column.name === "round_number");
  if (!hasRoundNumber) {
    db.exec("ALTER TABLE local_matches ADD COLUMN round_number INTEGER");
  }
  const hasPredictionsClosedAt = matchColumns.some(
    (column) => column.name === "predictions_closed_at",
  );
  if (!hasPredictionsClosedAt) {
    db.exec("ALTER TABLE local_matches ADD COLUMN predictions_closed_at TEXT");
  }
  const optionalMatchColumns = [
    ["prediction_warning_sent_at", "TEXT"],
    ["external_provider", "TEXT"],
    ["external_match_id", "TEXT"],
    ["external_mapping_checked_at", "TEXT"],
    ["live_status", "TEXT"],
    ["result_synced_at", "TEXT"],
    ["result_notified_at", "TEXT"],
  ];
  for (const [columnName, columnType] of optionalMatchColumns) {
    const hasColumn = matchColumns.some((column) => column.name === columnName);
    if (!hasColumn) {
      db.exec(`ALTER TABLE local_matches ADD COLUMN ${columnName} ${columnType}`);
    }
  }
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_local_matches_match_number ON local_matches(match_number)",
  );
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_local_matches_external_match ON local_matches(external_provider, external_match_id) WHERE external_provider IS NOT NULL AND external_match_id IS NOT NULL",
  );

}

function seedIfNeeded(db: DatabaseSync) {
  const usersCountRow = db
    .prepare("SELECT COUNT(*) AS total FROM local_users")
    .get() as { total: number };

  if (usersCountRow.total === 0) {
    const insertUser = db.prepare(`
      INSERT INTO local_users (
        id,
        email,
        username,
        display_name,
        password_hash,
        is_admin,
        is_active,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const profile of FIXTURE_PROFILES) {
      insertUser.run(
        profile.id,
        profile.email,
        profile.username,
        profile.displayName,
        hashPassword(FIXTURE_DEFAULT_PASSWORD),
        profile.isAdmin ? 1 : 0,
        profile.isActive ? 1 : 0,
        profile.createdAt,
      );
    }
  }

  const matchesCountRow = db
    .prepare("SELECT COUNT(*) AS total FROM local_matches")
    .get() as { total: number };

  if (matchesCountRow.total === 0) {
    const insertMatch = db.prepare(`
      INSERT INTO local_matches (
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = toIsoNow();
    for (const match of FIXTURE_MATCHES) {
      insertMatch.run(
        match.id,
        match.stage,
        match.groupName,
        match.matchNumber ?? null,
        match.roundNumber ?? null,
        match.homeTeam,
        match.awayTeam,
        match.kickoffAt,
        match.isClosed ? 1 : 0,
        match.homeScore,
        match.awayScore,
        match.venue,
        now,
        now,
      );
    }
  }

  const predictionsCountRow = db
    .prepare("SELECT COUNT(*) AS total FROM local_predictions")
    .get() as { total: number };

  if (predictionsCountRow.total === 0) {
    const insertPrediction = db.prepare(`
      INSERT INTO local_predictions (
        id,
        user_id,
        match_id,
        home_goals,
        away_goals,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const prediction of FIXTURE_PREDICTIONS) {
      insertPrediction.run(
        prediction.id,
        prediction.userId,
        prediction.matchId,
        prediction.homeGoals,
        prediction.awayGoals,
        prediction.createdAt,
        prediction.updatedAt,
      );
    }
  }
}

function getDb(): DatabaseSync {
  if (!globalThis.__bolaoLocalDb) {
    const folderPath = path.dirname(LOCAL_DB_PATH);
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }

    globalThis.__bolaoLocalDb = new DatabaseSync(LOCAL_DB_PATH);
  }

  if (globalThis.__bolaoLocalDbSchemaVersion !== LOCAL_SCHEMA_VERSION) {
    initializeSchema(globalThis.__bolaoLocalDb);
    seedIfNeeded(globalThis.__bolaoLocalDb);
    globalThis.__bolaoLocalDbSchemaVersion = LOCAL_SCHEMA_VERSION;
  }

  return globalThis.__bolaoLocalDb;
}

export function getLocalDatabasePath(): string {
  return LOCAL_DB_PATH;
}

export function getLocalViewerBySessionToken(token: string | undefined): Viewer | null {
  if (!token) {
    return null;
  }

  const db = getDb();
  const session = db
    .prepare(
      `
        SELECT token, user_id, expires_at
        FROM local_sessions
        WHERE token = ?
      `,
    )
    .get(token) as LocalSessionRow | undefined;

  if (!session) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM local_sessions WHERE token = ?").run(token);
    return null;
  }

  const user = db
    .prepare(
      `
        SELECT id, email, username, display_name, password_hash, is_admin, is_active, created_at
        FROM local_users
        WHERE id = ?
      `,
    )
    .get(session.user_id) as LocalUserRow | undefined;

  if (!user) {
    return null;
  }

  if (user.is_active !== 1) {
    db.prepare("DELETE FROM local_sessions WHERE token = ?").run(token);
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username ? sanitizeUsername(user.username) : deriveUsername(user.display_name, user.email),
    displayName: user.display_name,
    isAdmin: user.is_admin === 1,
    isActive: user.is_active === 1,
    source: "local",
  };
}

export function createLocalUser(params: {
  username: string;
  displayName: string;
  password: string;
}): Viewer {
  const normalizedUsername = sanitizeUsername(params.username);
  const email = usernameToEmail(normalizedUsername);
  const password = params.password.trim();
  const displayName = params.displayName.trim();

  if (!normalizedUsername || !displayName || !password) {
    throw new Error("Informe nome, usuario e senha.");
  }

  const db = getDb();
  const existingByUsername = db
    .prepare("SELECT id FROM local_users WHERE LOWER(username) = LOWER(?)")
    .get(normalizedUsername) as { id: string } | undefined;

  if (existingByUsername) {
    throw new Error("Usuario ja cadastrado.");
  }

  const existingByEmail = db
    .prepare("SELECT id FROM local_users WHERE email = ?")
    .get(email) as { id: string } | undefined;

  if (existingByEmail) {
    throw new Error("Usuario ja cadastrado.");
  }

  const adminsCount = db
    .prepare("SELECT COUNT(*) AS total FROM local_users WHERE is_admin = 1")
    .get() as { total: number };
  const isAdmin = adminsCount.total === 0;

  const userId = randomUUID();
  const now = toIsoNow();

  db.prepare(
    `
      INSERT INTO local_users (
        id,
        email,
        username,
        display_name,
        password_hash,
        is_admin,
        is_active,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    userId,
    email,
    normalizedUsername,
    displayName,
    hashPassword(password),
    isAdmin ? 1 : 0,
    1,
    now,
  );

  return {
    id: userId,
    email,
    username: normalizedUsername,
    displayName,
    isAdmin,
    isActive: true,
    source: "local",
  };
}

export function authenticateLocalUser(
  usernameInput: string,
  passwordInput: string,
): Viewer {
  const normalizedInput = normalizeUsername(usernameInput);
  const normalizedUsername = sanitizeUsername(usernameInput);
  const password = passwordInput.trim();
  const syntheticEmail = usernameToEmail(normalizedUsername);

  if (!normalizedInput || !password) {
    throw new Error("Informe usuario e senha.");
  }

  const db = getDb();
  const user = isEmailLike(normalizedInput)
    ? (db
        .prepare(
          `
            SELECT id, email, username, display_name, password_hash, is_admin, is_active, created_at
            FROM local_users
            WHERE LOWER(email) = LOWER(?)
          `,
        )
        .get(normalizedInput) as LocalUserRow | undefined)
    : (db
        .prepare(
          `
            SELECT id, email, username, display_name, password_hash, is_admin, is_active, created_at
            FROM local_users
            WHERE LOWER(username) = LOWER(?)
               OR LOWER(email) = LOWER(?)
            LIMIT 1
          `,
        )
        .get(normalizedUsername, syntheticEmail) as LocalUserRow | undefined);

  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new Error("Usuario ou senha invalidos.");
  }
  if (user.is_active !== 1) {
    throw new Error("Conta desativada. Contate um administrador.");
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username ? sanitizeUsername(user.username) : deriveUsername(user.display_name, user.email),
    displayName: user.display_name,
    isAdmin: user.is_admin === 1,
    isActive: user.is_active === 1,
    source: "local",
  };
}

export function createLocalSession(userId: string): string {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  db.prepare(
    `
      INSERT INTO local_sessions (token, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `,
  ).run(token, userId, expiresAt.toISOString(), now.toISOString());

  return token;
}

export function deleteLocalSession(token: string | undefined) {
  if (!token) {
    return;
  }

  const db = getDb();
  db.prepare("DELETE FROM local_sessions WHERE token = ?").run(token);
}

export function getLocalProfiles(): Profile[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM local_users ORDER BY display_name ASC").all() as LocalUserRow[];
  return rows.map(mapUserToProfile);
}

export function getLocalAccounts(): Profile[] {
  return getLocalProfiles();
}

export function getLocalMatches(): Match[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM local_matches ORDER BY kickoff_at ASC")
    .all() as LocalMatchRow[];
  return rows.map(mapMatchRow);
}

export function getLocalPredictionsForUser(userId: string): Prediction[] {
  if (!userId) {
    return [];
  }

  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM local_predictions WHERE user_id = ? ORDER BY created_at ASC")
    .all(userId) as LocalPredictionRow[];
  return rows.map(mapPredictionRow);
}

export function getLocalAllPredictions(): Prediction[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM local_predictions").all() as LocalPredictionRow[];
  return rows.map(mapPredictionRow);
}

export function getLocalLeaderboard(): LeaderboardRow[] {
  const profiles = getLocalProfiles();
  const matches = getLocalMatches();
  const predictions = getLocalAllPredictions();
  return buildLeaderboard(profiles, matches, predictions);
}

export function upsertLocalPrediction(params: {
  userId: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
}): Prediction {
  const { userId, matchId, homeGoals, awayGoals } = params;
  if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals)) {
    throw new Error("Placar invÃ¡lido.");
  }
  if (homeGoals < 0 || awayGoals < 0) {
    throw new Error("Os gols nÃ£o podem ser negativos.");
  }

  const db = getDb();
  const matchRow = db
    .prepare("SELECT * FROM local_matches WHERE id = ?")
    .get(matchId) as LocalMatchRow | undefined;

  if (!matchRow) {
    throw new Error("Jogo nÃ£o encontrado.");
  }

  const match = mapMatchRow(matchRow);
  if (isPredictionLocked(match)) {
    throw new Error("O jogo jÃ¡ estÃ¡ bloqueado para palpites.");
  }

  const existingPrediction = db
    .prepare("SELECT id, created_at FROM local_predictions WHERE user_id = ? AND match_id = ?")
    .get(userId, matchId) as { id: string; created_at: string } | undefined;

  const now = toIsoNow();
  if (existingPrediction) {
    db.prepare(
      `
        UPDATE local_predictions
        SET home_goals = ?, away_goals = ?, updated_at = ?
        WHERE id = ?
      `,
    ).run(homeGoals, awayGoals, now, existingPrediction.id);

    return {
      id: existingPrediction.id,
      userId,
      matchId,
      homeGoals,
      awayGoals,
      createdAt: existingPrediction.created_at,
      updatedAt: now,
    };
  }

  const predictionId = randomUUID();
  db.prepare(
    `
      INSERT INTO local_predictions (
        id,
        user_id,
        match_id,
        home_goals,
        away_goals,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(predictionId, userId, matchId, homeGoals, awayGoals, now, now);

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

export function createLocalMatch(params: {
  stage: MatchStage;
  groupName: string | null;
  matchNumber?: number | null;
  roundNumber?: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string | null;
}) {
  const db = getDb();
  const matchId = randomUUID();
  const now = toIsoNow();

  db.prepare(
    `
      INSERT INTO local_matches (
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?)
    `,
  ).run(
    matchId,
    params.stage,
    params.groupName,
    params.matchNumber ?? null,
    params.roundNumber ?? null,
    params.homeTeam,
    params.awayTeam,
    params.kickoffAt,
    params.venue,
    now,
    now,
  );
}

export function upsertLocalMatchByNumber(params: {
  stage: MatchStage;
  groupName: string | null;
  matchNumber: number;
  roundNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string | null;
}): "inserted" | "updated" {
  if (!Number.isInteger(params.matchNumber) || params.matchNumber <= 0) {
    throw new Error("Numero da partida invalido.");
  }
  if (
    params.roundNumber !== null &&
    (!Number.isInteger(params.roundNumber) || params.roundNumber <= 0)
  ) {
    throw new Error("Rodada invalida.");
  }

  const db = getDb();
  const now = toIsoNow();
  const existing = db
    .prepare("SELECT id FROM local_matches WHERE match_number = ? LIMIT 1")
    .get(params.matchNumber) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `
        UPDATE local_matches
        SET
          stage = ?,
          group_name = ?,
          round_number = ?,
          home_team = ?,
          away_team = ?,
          kickoff_at = ?,
          venue = ?,
          updated_at = ?
        WHERE id = ?
      `,
    ).run(
      params.stage,
      params.groupName,
      params.roundNumber,
      params.homeTeam,
      params.awayTeam,
      params.kickoffAt,
      params.venue,
      now,
      existing.id,
    );
    return "updated";
  }

  db.prepare(
    `
      INSERT INTO local_matches (
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?)
    `,
  ).run(
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
    now,
  );

  return "inserted";
}

export function closeLocalMatch(matchId: string, homeScore: number, awayScore: number) {
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    throw new Error("Placar invÃ¡lido.");
  }
  if (homeScore < 0 || awayScore < 0) {
    throw new Error("Placar invÃ¡lido.");
  }

  const db = getDb();
  db.prepare(
    `
      UPDATE local_matches
      SET home_score = ?, away_score = ?, is_closed = 1, updated_at = ?
      WHERE id = ?
    `,
  ).run(homeScore, awayScore, toIsoNow(), matchId);
}

export function reopenLocalMatch(matchId: string) {
  const db = getDb();
  db.prepare(
    `
      UPDATE local_matches
      SET home_score = NULL, away_score = NULL, is_closed = 0, updated_at = ?
      WHERE id = ?
    `,
  ).run(toIsoNow(), matchId);
}

export function setLocalUserAdmin(userId: string, makeAdmin: boolean) {
  const db = getDb();
  const user = db
    .prepare("SELECT id, is_admin FROM local_users WHERE id = ?")
    .get(userId) as { id: string; is_admin: number } | undefined;

  if (!user) {
    throw new Error("UsuÃ¡rio nÃ£o encontrado.");
  }

  if (!makeAdmin && user.is_admin === 1) {
    const adminCount = db
      .prepare("SELECT COUNT(*) AS total FROM local_users WHERE is_admin = 1")
      .get() as { total: number };
    if (adminCount.total <= 1) {
      throw new Error("NÃ£o Ã© possÃ­vel remover o Ãºltimo admin.");
    }
  }

  db.prepare("UPDATE local_users SET is_admin = ? WHERE id = ?").run(
    makeAdmin ? 1 : 0,
    userId,
  );
}

export function setLocalUserActive(userId: string, makeActive: boolean) {
  const db = getDb();
  const user = db
    .prepare("SELECT id, is_admin, is_active FROM local_users WHERE id = ?")
    .get(userId) as { id: string; is_admin: number; is_active: number } | undefined;

  if (!user) {
    throw new Error("UsuÃ¡rio nÃ£o encontrado.");
  }

  if (!makeActive && user.is_admin === 1) {
    const activeAdminCount = db
      .prepare("SELECT COUNT(*) AS total FROM local_users WHERE is_admin = 1 AND is_active = 1")
      .get() as { total: number };
    if (activeAdminCount.total <= 1 && user.is_active === 1) {
      throw new Error("NÃ£o Ã© possÃ­vel desativar o Ãºltimo admin ativo.");
    }
  }

  db.prepare("UPDATE local_users SET is_active = ? WHERE id = ?").run(
    makeActive ? 1 : 0,
    userId,
  );

  if (!makeActive) {
    db.prepare("DELETE FROM local_sessions WHERE user_id = ?").run(userId);
  }
}

export function updateLocalUserCredentials(
  userId: string,
  params: { username: string; password?: string },
) {
  const db = getDb();
  const normalizedUsername = sanitizeUsername(params.username);
  const nextPassword = params.password?.trim();

  if (!normalizedUsername) {
    throw new Error("Informe um usuario valido.");
  }

  const user = db
    .prepare("SELECT id FROM local_users WHERE id = ?")
    .get(userId) as { id: string } | undefined;
  if (!user) {
    throw new Error("Usuario nao encontrado.");
  }

  const usernameTaken = db
    .prepare("SELECT id FROM local_users WHERE LOWER(username) = LOWER(?) AND id <> ?")
    .get(normalizedUsername, userId) as { id: string } | undefined;
  if (usernameTaken) {
    throw new Error("Usuario ja esta em uso.");
  }

  const nextEmail = usernameToEmail(normalizedUsername);
  const emailTaken = db
    .prepare("SELECT id FROM local_users WHERE email = ? AND id <> ?")
    .get(nextEmail, userId) as { id: string } | undefined;
  if (emailTaken) {
    throw new Error("Nao foi possivel atualizar para este usuario.");
  }

  if (nextPassword) {
    if (nextPassword.length < 6) {
      throw new Error("A nova senha deve ter ao menos 6 caracteres.");
    }

    db.prepare(
      `
        UPDATE local_users
        SET username = ?, email = ?, password_hash = ?
        WHERE id = ?
      `,
    ).run(normalizedUsername, nextEmail, hashPassword(nextPassword), userId);
    return;
  }

  db.prepare(
    `
      UPDATE local_users
      SET username = ?, email = ?
      WHERE id = ?
    `,
  ).run(normalizedUsername, nextEmail, userId);
}

export function ensureLocalDatabase() {
  getDb();
}




