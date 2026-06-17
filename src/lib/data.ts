import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import {
  getAppLeaderboard,
  getAppMatches,
  getAppPredictions,
  getAppPredictionsForUser,
  getAppProfiles,
  getAppSessionCookieName,
  getAppViewerBySessionToken,
} from "@/lib/app-db";
import { buildLeaderboard, isMatchFinished, sortLeaderboard } from "@/lib/scoring";
import { isSupabaseConfigured } from "@/lib/supabase-env";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isPostgresConnectionConfigured } from "@/lib/storage-mode";
import type {
  DashboardSummary,
  LeaderboardRow,
  Match,
  Prediction,
  Profile,
  Viewer,
} from "@/lib/types";

function mapProfileRow(row: Record<string, unknown>): Profile {
  const email = String(row.email ?? "");
  const fallbackUsername =
    email.split("@")[0] || String(row.display_name ?? "participante");

  return {
    id: String(row.id),
    email,
    username: String(row.username ?? fallbackUsername).toLowerCase(),
    displayName: String(row.display_name ?? row.email ?? "Participante"),
    isAdmin: Boolean(row.is_admin),
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    createdAt: String(row.created_at ?? new Date(0).toISOString()),
  };
}

function mapMatchRow(row: Record<string, unknown>): Match {
  const hasScore =
    typeof row.home_score === "number" && typeof row.away_score === "number";

  return {
    id: String(row.id),
    stage: String(row.stage) as Match["stage"],
    groupName: row.group_name ? String(row.group_name) : null,
    matchNumber: typeof row.match_number === "number" ? row.match_number : null,
    roundNumber: typeof row.round_number === "number" ? row.round_number : null,
    homeTeam: String(row.home_team),
    awayTeam: String(row.away_team),
    kickoffAt: String(row.kickoff_at),
    predictionsClosedAt: row.predictions_closed_at
      ? String(row.predictions_closed_at)
      : null,
    isClosed: typeof row.is_closed === "boolean" ? row.is_closed : hasScore,
    homeScore: typeof row.home_score === "number" ? row.home_score : null,
    awayScore: typeof row.away_score === "number" ? row.away_score : null,
    venue: row.venue ? String(row.venue) : null,
  };
}

function mapPredictionRow(row: Record<string, unknown>): Prediction {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    matchId: String(row.match_id),
    homeGoals: Number(row.home_goals),
    awayGoals: Number(row.away_goals),
    createdAt: String(row.created_at ?? new Date(0).toISOString()),
    updatedAt: String(row.updated_at ?? new Date(0).toISOString()),
  };
}

function mapLeaderboardRow(row: Record<string, unknown>): LeaderboardRow {
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name ?? "Participante"),
    totalPoints: Number(row.total_points ?? 0),
    exactScores: Number(row.exact_scores ?? 0),
    goalDiffHits: Number(row.goal_diff_hits ?? 0),
    resultHits: Number(row.result_hits ?? 0),
    oneTeamGoalHits: Number(row.one_team_goal_hits ?? 0),
    predictionsCount: Number(row.predictions_count ?? 0),
  };
}

function anonymousViewer(source: Viewer["source"]): Viewer {
  return {
    id: "",
    email: "",
    username: "",
    displayName: "Visitante",
    isAdmin: false,
    isActive: false,
    source,
  };
}

export async function getCurrentViewer(): Promise<Viewer> {
  noStore();

  if (isSupabaseConfigured()) {
    const client = await getSupabaseServerClient();
    if (!client) {
      return anonymousViewer("supabase");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return anonymousViewer("supabase");
    }

    const { data: profileRow } = await client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileRow) {
      const profile = mapProfileRow(profileRow);
      return {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        displayName: profile.displayName,
        isAdmin: profile.isAdmin,
        isActive: profile.isActive,
        source: "supabase",
      };
    }

    return {
      id: user.id,
      email: user.email ?? "",
      username:
        typeof user.user_metadata?.username === "string"
          ? user.user_metadata.username
          : user.email?.split("@")[0] ?? "",
      displayName:
        typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : user.email?.split("@")[0] ?? "Participante",
      isAdmin: false,
      isActive: true,
      source: "supabase",
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(getAppSessionCookieName())?.value;
  const viewer = await getAppViewerBySessionToken(token);
  return viewer ?? anonymousViewer(isPostgresConnectionConfigured() ? "postgres" : "local");
}

export async function getMatches(): Promise<Match[]> {
  noStore();

  if (!isSupabaseConfigured()) {
    return getAppMatches();
  }

  const client = await getSupabaseServerClient();
  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("matches")
    .select("*")
    .order("kickoff_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => mapMatchRow(row));
}

export async function getProfiles(): Promise<Profile[]> {
  noStore();

  if (!isSupabaseConfigured()) {
    return getAppProfiles();
  }

  const client = await getSupabaseServerClient();
  if (!client) {
    return [];
  }

  const { data, error } = await client.from("profiles").select("*");
  if (error || !data) {
    return [];
  }

  return data.map((row) => mapProfileRow(row));
}

export async function getPredictionsForUser(userId: string): Promise<Prediction[]> {
  noStore();

  if (!userId) {
    return [];
  }

  if (!isSupabaseConfigured()) {
    return getAppPredictionsForUser(userId);
  }

  const client = await getSupabaseServerClient();
  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("predictions")
    .select("*")
    .eq("user_id", userId);

  if (error || !data) {
    return [];
  }

  return data.map((row) => mapPredictionRow(row));
}

export async function getPredictions(): Promise<Prediction[]> {
  noStore();

  if (!isSupabaseConfigured()) {
    return getAppPredictions();
  }

  const client = await getSupabaseServerClient();
  if (!client) {
    return [];
  }

  const { data, error } = await client.from("predictions").select("*");

  if (error || !data) {
    return [];
  }

  return data.map((row) => mapPredictionRow(row));
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  noStore();

  if (!isSupabaseConfigured()) {
    return getAppLeaderboard();
  }

  const client = await getSupabaseServerClient();
  if (!client) {
    return [];
  }

  const leaderboardFromView = await client.from("leaderboard").select("*");
  if (leaderboardFromView.data && !leaderboardFromView.error) {
    return sortLeaderboard(leaderboardFromView.data.map((row) => mapLeaderboardRow(row)));
  }

  const [profilesRows, matchesRows, predictionsRows] = await Promise.all([
    client.from("profiles").select("*"),
    client.from("matches").select("*"),
    client.from("predictions").select("*"),
  ]);

  if (profilesRows.error || matchesRows.error || predictionsRows.error) {
    return [];
  }

  return buildLeaderboard(
    (profilesRows.data ?? []).map((row) => mapProfileRow(row)),
    (matchesRows.data ?? []).map((row) => mapMatchRow(row)),
    (predictionsRows.data ?? []).map((row) => mapPredictionRow(row)),
  );
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [matches, leaderboard] = await Promise.all([getMatches(), getLeaderboard()]);
  const now = Date.now();

  const upcomingMatches = matches
    .filter((match) => new Date(match.kickoffAt).getTime() > now)
    .sort((left, right) => {
      return (
        new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime()
      );
    })
    .slice(0, 5);

  return {
    totalMatches: matches.length,
    finishedMatches: matches.filter((match) => isMatchFinished(match)).length,
    upcomingMatches,
    topParticipants: leaderboard.slice(0, 5),
  };
}
