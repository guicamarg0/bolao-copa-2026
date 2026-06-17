import {
  authenticateLocalUser,
  closeLocalMatch,
  createLocalMatch,
  createLocalSession,
  createLocalUser,
  deleteLocalSession,
  getLocalAccounts,
  getLocalAllPredictions,
  getLocalLeaderboard,
  getLocalMatches,
  getLocalPredictionsForUser,
  getLocalProfiles,
  getLocalViewerBySessionToken,
  LOCAL_SESSION_COOKIE_NAME,
  reopenLocalMatch,
  setLocalUserActive,
  setLocalUserAdmin,
  upsertLocalMatchByNumber,
  updateLocalUserCredentials,
  upsertLocalPrediction,
} from "@/lib/local-db";
import {
  authenticatePostgresUser,
  closePostgresMatch,
  createPostgresMatch,
  createPostgresSession,
  createPostgresUser,
  deletePostgresSession,
  getPostgresAccounts,
  getPostgresAllPredictions,
  getPostgresLeaderboard,
  getPostgresMatches,
  getPostgresPredictionsForUser,
  getPostgresProfiles,
  getPostgresViewerBySessionToken,
  isPostgresConfigured,
  reopenPostgresMatch,
  setPostgresUserActive,
  setPostgresUserAdmin,
  upsertPostgresMatchByNumber,
  updatePostgresUserCredentials,
  upsertPostgresPrediction,
} from "@/lib/postgres-db";
import type { MatchStage, Prediction, Profile, Viewer } from "@/lib/types";

export type AppStorageMode = "postgres" | "sqlite";

export function getAppStorageMode(): AppStorageMode {
  return isPostgresConfigured() ? "postgres" : "sqlite";
}

export function getAppSessionCookieName(): string {
  return LOCAL_SESSION_COOKIE_NAME;
}

export async function getAppViewerBySessionToken(
  token: string | undefined,
): Promise<Viewer | null> {
  if (getAppStorageMode() === "postgres") {
    return getPostgresViewerBySessionToken(token);
  }
  return getLocalViewerBySessionToken(token);
}

export async function authenticateAppUser(
  username: string,
  password: string,
): Promise<Viewer> {
  if (getAppStorageMode() === "postgres") {
    return authenticatePostgresUser(username, password);
  }
  return authenticateLocalUser(username, password);
}

export async function createAppUser(params: {
  username: string;
  displayName: string;
  password: string;
}): Promise<Viewer> {
  if (getAppStorageMode() === "postgres") {
    return createPostgresUser(params);
  }
  return createLocalUser(params);
}

export async function createAppSession(userId: string): Promise<string> {
  if (getAppStorageMode() === "postgres") {
    return createPostgresSession(userId);
  }
  return createLocalSession(userId);
}

export async function deleteAppSession(token: string | undefined): Promise<void> {
  if (getAppStorageMode() === "postgres") {
    await deletePostgresSession(token);
    return;
  }
  deleteLocalSession(token);
}

export async function getAppProfiles(): Promise<Profile[]> {
  if (getAppStorageMode() === "postgres") {
    return getPostgresProfiles();
  }
  return getLocalProfiles();
}

export async function getAppAccounts(): Promise<Profile[]> {
  if (getAppStorageMode() === "postgres") {
    return getPostgresAccounts();
  }
  return getLocalAccounts();
}

export async function setAppUserAdmin(userId: string, makeAdmin: boolean): Promise<void> {
  if (getAppStorageMode() === "postgres") {
    await setPostgresUserAdmin(userId, makeAdmin);
    return;
  }
  setLocalUserAdmin(userId, makeAdmin);
}

export async function setAppUserActive(userId: string, makeActive: boolean): Promise<void> {
  if (getAppStorageMode() === "postgres") {
    await setPostgresUserActive(userId, makeActive);
    return;
  }
  setLocalUserActive(userId, makeActive);
}

export async function updateAppUserCredentials(params: {
  userId: string;
  username: string;
  password?: string;
}): Promise<void> {
  if (getAppStorageMode() === "postgres") {
    await updatePostgresUserCredentials(params.userId, {
      username: params.username,
      password: params.password,
    });
    return;
  }
  updateLocalUserCredentials(params.userId, {
    username: params.username,
    password: params.password,
  });
}

export async function getAppMatches() {
  if (getAppStorageMode() === "postgres") {
    return getPostgresMatches();
  }
  return getLocalMatches();
}

export async function getAppPredictionsForUser(userId: string) {
  if (getAppStorageMode() === "postgres") {
    return getPostgresPredictionsForUser(userId);
  }
  return getLocalPredictionsForUser(userId);
}

export async function getAppPredictions() {
  if (getAppStorageMode() === "postgres") {
    return getPostgresAllPredictions();
  }
  return getLocalAllPredictions();
}

export async function getAppLeaderboard() {
  if (getAppStorageMode() === "postgres") {
    return getPostgresLeaderboard();
  }
  return getLocalLeaderboard();
}

export async function upsertAppPrediction(params: {
  userId: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
}): Promise<Prediction> {
  if (getAppStorageMode() === "postgres") {
    return upsertPostgresPrediction(params);
  }
  return upsertLocalPrediction(params);
}

export async function createAppMatch(params: {
  stage: MatchStage;
  groupName: string | null;
  matchNumber?: number | null;
  roundNumber?: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string | null;
}): Promise<void> {
  if (getAppStorageMode() === "postgres") {
    await createPostgresMatch(params);
    return;
  }
  createLocalMatch(params);
}

export async function upsertAppMatchByNumber(params: {
  stage: MatchStage;
  groupName: string | null;
  matchNumber: number;
  roundNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string | null;
}): Promise<"inserted" | "updated"> {
  if (getAppStorageMode() === "postgres") {
    return upsertPostgresMatchByNumber(params);
  }
  return upsertLocalMatchByNumber(params);
}

export async function closeAppMatch(
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  if (getAppStorageMode() === "postgres") {
    await closePostgresMatch(matchId, homeScore, awayScore);
    return;
  }
  closeLocalMatch(matchId, homeScore, awayScore);
}

export async function reopenAppMatch(matchId: string): Promise<void> {
  if (getAppStorageMode() === "postgres") {
    await reopenPostgresMatch(matchId);
    return;
  }
  reopenLocalMatch(matchId);
}
