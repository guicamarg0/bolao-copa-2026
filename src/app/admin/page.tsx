import Link from "next/link";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminQuickModal } from "@/components/admin-quick-modal";
import { AppShell } from "@/components/app-shell";
import { TeamPill } from "@/components/team-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Surface } from "@/components/ui/surface";
import { requireAuthenticatedViewer } from "@/lib/auth-guard";
import {
  closeAppMatch,
  createAppMatch,
  getAppSessionCookieName,
  getAppViewerBySessionToken,
  reopenAppMatch,
  setAppUserActive,
  setAppUserAdmin,
  upsertAppMatchByNumber,
  updateAppUserCredentials,
} from "@/lib/app-db";
import { getMatches, getProfiles } from "@/lib/data";
import { parseMatchesCsv } from "@/lib/match-csv";
import { notifyFinishedMatchResult } from "@/lib/match-prediction-report";
import { STAGE_LABEL } from "@/lib/match-ui";
import { getStorageMode } from "@/lib/storage-mode";
import { isSupabaseConfigured } from "@/lib/supabase-env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { WORLD_CUP_2026_TEAMS } from "@/lib/teams";
import type { Match, MatchStage } from "@/lib/types";

const stageOptions: Array<{ value: MatchStage; label: string }> = [
  { value: "group", label: "Fase de grupos" },
  { value: "round_of_32", label: "32 avos" },
  { value: "round_of_16", label: "Oitavas" },
  { value: "quarterfinal", label: "Quartas" },
  { value: "semifinal", label: "Semifinal" },
  { value: "third_place", label: "3o lugar" },
  { value: "final", label: "Final" },
];

type ScoreStatusFilter = "all" | "open" | "closed";
const SCORE_PAGE_SIZE = 6;

function toSafeQueryValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toSafeCount(value: unknown): number {
  const parsed = Number.parseInt(toSafeQueryValue(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function toPositivePage(value: unknown): number {
  const parsed = Number.parseInt(toSafeQueryValue(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function toScoreStatusFilter(value: unknown): ScoreStatusFilter {
  const parsed = toSafeQueryValue(value);
  if (parsed === "open" || parsed === "closed") {
    return parsed;
  }
  return "all";
}

function buildScoreOptions(matches: Match[]) {
  const stage = Array.from(new Set(matches.map((match) => match.stage)));
  const group = Array.from(
    new Set(
      matches
        .map((match) => match.groupName)
        .filter((current): current is string => Boolean(current)),
    ),
  ).sort((left, right) =>
    left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" }),
  );
  const round = Array.from(
    new Set(
      matches
        .map((match) => match.roundNumber)
        .filter((current): current is number => Number.isInteger(current)),
    ),
  ).sort((left, right) => left - right);

  return { stage, group, round };
}

function parseOptionalPositiveInt(raw: FormDataEntryValue | null): number | null | "invalid" {
  const value = String(raw ?? "").trim();
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return "invalid";
  }
  return parsed;
}

async function requireSupabaseAdmin(): Promise<{ id: string }> {
  const client = await getSupabaseServerClient();
  if (!client) {
    throw new Error("Cliente Supabase indisponivel.");
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error("Faca login.");
  }

  const { data: profile } = await client
    .from("profiles")
    .select("id,is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    throw new Error("Acao permitida apenas para admin.");
  }

  return { id: user.id };
}

async function requireAppAdmin(): Promise<{ id: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAppSessionCookieName())?.value;
  const viewer = await getAppViewerBySessionToken(token);

  if (!viewer?.isAdmin) {
    throw new Error("Acao permitida apenas para admin.");
  }

  return { id: viewer.id };
}

async function createMatch(formData: FormData) {
  "use server";

  const stage = String(formData.get("stage") ?? "") as MatchStage;
  const groupNameRaw = String(formData.get("group_name") ?? "").trim();
  const matchNumberRaw = parseOptionalPositiveInt(formData.get("match_number"));
  const roundNumberRaw = parseOptionalPositiveInt(formData.get("round_number"));
  const homeTeam = String(formData.get("home_team") ?? "").trim();
  const awayTeam = String(formData.get("away_team") ?? "").trim();
  const kickoffLocal = String(formData.get("kickoff_at") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim();

  if (!stage || !homeTeam || !awayTeam || !kickoffLocal) {
    return;
  }
  if (homeTeam === awayTeam) {
    return;
  }
  if (matchNumberRaw === "invalid" || roundNumberRaw === "invalid") {
    return;
  }
  const matchNumber = matchNumberRaw;
  const roundNumber = roundNumberRaw;

  const kickoffDate = new Date(kickoffLocal);
  if (Number.isNaN(kickoffDate.getTime())) {
    return;
  }

  if (isSupabaseConfigured()) {
    await requireSupabaseAdmin();
    const client = await getSupabaseServerClient();
    if (!client) {
      return;
    }

    await client.from("matches").insert({
      stage,
      group_name: groupNameRaw || null,
      match_number: matchNumber,
      round_number: roundNumber,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff_at: kickoffDate.toISOString(),
      venue: venue || null,
      is_closed: false,
    });
  } else {
    await requireAppAdmin();
    await createAppMatch({
      stage,
      groupName: groupNameRaw || null,
      matchNumber,
      roundNumber,
      homeTeam,
      awayTeam,
      kickoffAt: kickoffDate.toISOString(),
      venue: venue || null,
    });
  }

  revalidatePath("/");
  revalidatePath("/jogos");
  revalidatePath("/palpites");
  revalidatePath("/admin");
}

async function importMatchesCsv(formData: FormData) {
  "use server";

  const csvText = String(formData.get("csv_matches") ?? "");
  const parsed = parseMatchesCsv(csvText);

  if (parsed.rows.length === 0) {
    const fallback = parsed.issues[0]?.message ?? "Nenhuma linha valida encontrada no CSV.";
    redirect(`/admin?csv_error=${encodeURIComponent(fallback)}`);
  }

  let inserted = 0;
  let updated = 0;
  const importIssues = [...parsed.issues];

  if (isSupabaseConfigured()) {
    await requireSupabaseAdmin();
    const client = await getSupabaseServerClient();
    if (!client) {
      redirect("/admin?csv_error=Cliente%20Supabase%20indisponivel.");
    }

    const matchNumbers = parsed.rows.map((row) => row.matchNumber);
    const existingRows = await client
      .from("matches")
      .select("match_number")
      .in("match_number", matchNumbers);

    if (existingRows.error) {
      redirect(`/admin?csv_error=${encodeURIComponent(existingRows.error.message)}`);
    }

    const existing = new Set<number>(
      (existingRows.data ?? [])
        .map((row) =>
          typeof row.match_number === "number" ? row.match_number : Number.NaN,
        )
        .filter((value) => Number.isInteger(value)),
    );

    for (const row of parsed.rows) {
      const payload = {
        stage: row.stage,
        group_name: row.groupName,
        match_number: row.matchNumber,
        round_number: row.roundNumber,
        home_team: row.homeTeam,
        away_team: row.awayTeam,
        kickoff_at: row.kickoffAt,
        venue: row.venue,
      };

      if (existing.has(row.matchNumber)) {
        const { error } = await client
          .from("matches")
          .update(payload)
          .eq("match_number", row.matchNumber);

        if (error) {
          importIssues.push({
            line: 0,
            message: `Partida ${row.matchNumber}: ${error.message}`,
          });
          continue;
        }

        updated += 1;
        continue;
      }

      const { error } = await client.from("matches").insert({
        ...payload,
        is_closed: false,
      });
      if (error) {
        importIssues.push({
          line: 0,
          message: `Partida ${row.matchNumber}: ${error.message}`,
        });
        continue;
      }

      existing.add(row.matchNumber);
      inserted += 1;
    }
  } else {
    await requireAppAdmin();
    for (const row of parsed.rows) {
      try {
        const outcome = await upsertAppMatchByNumber({
          stage: row.stage,
          groupName: row.groupName,
          matchNumber: row.matchNumber,
          roundNumber: row.roundNumber,
          homeTeam: row.homeTeam,
          awayTeam: row.awayTeam,
          kickoffAt: row.kickoffAt,
          venue: row.venue,
        });

        if (outcome === "inserted") {
          inserted += 1;
        } else {
          updated += 1;
        }
      } catch (error) {
        importIssues.push({
          line: 0,
          message:
            error instanceof Error
              ? `Partida ${row.matchNumber}: ${error.message}`
              : `Partida ${row.matchNumber}: erro ao importar.`,
        });
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/jogos");
  revalidatePath("/palpites");
  revalidatePath("/admin");

  const params = new URLSearchParams();
  params.set("csv_done", "1");
  params.set("csv_inserted", String(inserted));
  params.set("csv_updated", String(updated));
  params.set("csv_skipped", String(importIssues.length));
  if (importIssues.length > 0) {
    const summarized = importIssues
      .slice(0, 3)
      .map((issue) =>
        issue.line > 0 ? `Linha ${issue.line}: ${issue.message}` : issue.message,
      )
      .join(" | ");
    params.set("csv_error", summarized);
  }

  redirect(`/admin?${params.toString()}`);
}

async function saveOfficialResult(formData: FormData) {
  "use server";

  const matchId = String(formData.get("match_id") ?? "");
  const homeScore = Number(formData.get("home_score"));
  const awayScore = Number(formData.get("away_score"));

  if (!matchId || !Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    return;
  }

  if (isSupabaseConfigured()) {
    await requireSupabaseAdmin();
    const client = await getSupabaseServerClient();
    if (!client) {
      return;
    }

    await client
      .from("matches")
      .update({
        home_score: homeScore,
        away_score: awayScore,
        is_closed: true,
      })
      .eq("id", matchId);
  } else {
    await requireAppAdmin();
    await closeAppMatch(matchId, homeScore, awayScore);
  }

  await notifyFinishedMatchResult({ matchId, homeScore, awayScore }).catch(() => null);

  revalidatePath("/");
  revalidatePath("/jogos");
  revalidatePath("/palpites");
  revalidatePath("/palpites-fechados");
  revalidatePath("/ranking");
  revalidatePath("/admin");
}

async function reopenMatch(formData: FormData) {
  "use server";

  const matchId = String(formData.get("match_id") ?? "");
  if (!matchId) {
    return;
  }

  if (isSupabaseConfigured()) {
    await requireSupabaseAdmin();
    const client = await getSupabaseServerClient();
    if (!client) {
      return;
    }

    await client
      .from("matches")
      .update({
        home_score: null,
        away_score: null,
        is_closed: false,
      })
      .eq("id", matchId);
  } else {
    await requireAppAdmin();
    await reopenAppMatch(matchId);
  }

  revalidatePath("/");
  revalidatePath("/jogos");
  revalidatePath("/palpites");
  revalidatePath("/palpites-fechados");
  revalidatePath("/ranking");
  revalidatePath("/admin");
}

async function updateAccountAdmin(formData: FormData) {
  "use server";

  const userId = String(formData.get("user_id") ?? "");
  const nextAdmin = String(formData.get("next_admin") ?? "") === "true";
  if (!userId) {
    return;
  }

  if (isSupabaseConfigured()) {
    const actor = await requireSupabaseAdmin();
    const client = await getSupabaseServerClient();
    if (!client) {
      return;
    }

    if (!nextAdmin) {
      const { data: allAdmins } = await client
        .from("profiles")
        .select("id")
        .eq("is_admin", true);
      if ((allAdmins?.length ?? 0) <= 1) {
        throw new Error("Nao e possivel remover o ultimo admin.");
      }
      if (actor.id === userId && (allAdmins?.length ?? 0) <= 1) {
        throw new Error("Nao e possivel remover seu proprio admin final.");
      }
    }

    await client.from("profiles").update({ is_admin: nextAdmin }).eq("id", userId);
  } else {
    await requireAppAdmin();
    await setAppUserAdmin(userId, nextAdmin);
  }

  revalidatePath("/admin");
}

async function updateAccountStatus(formData: FormData) {
  "use server";

  const userId = String(formData.get("user_id") ?? "");
  const nextActive = String(formData.get("next_active") ?? "") === "true";
  if (!userId) {
    return;
  }

  if (isSupabaseConfigured()) {
    await requireSupabaseAdmin();
    const client = await getSupabaseServerClient();
    if (!client) {
      return;
    }

    await client.from("profiles").update({ is_active: nextActive }).eq("id", userId);
  } else {
    await requireAppAdmin();
    await setAppUserActive(userId, nextActive);
  }

  revalidatePath("/admin");
}

async function resetAccountPassword(formData: FormData) {
  "use server";

  const userId = String(formData.get("user_id") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const nextPassword = String(formData.get("password") ?? "").trim();
  const confirmPassword = String(formData.get("confirm_password") ?? "").trim();

  let destination = "/admin?password_reset=1";

  try {
    if (!userId || !username) {
      throw new Error("Usuario invalido.");
    }
    if (nextPassword.length < 6) {
      throw new Error("A nova senha deve ter ao menos 6 caracteres.");
    }
    if (nextPassword !== confirmPassword) {
      throw new Error("A confirmacao da senha nao confere.");
    }

    if (isSupabaseConfigured()) {
      await requireSupabaseAdmin();
      const adminClient = getSupabaseAdminClient();
      if (!adminClient) {
        throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY para resetar senhas.");
      }

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        password: nextPassword,
      });
      if (error) {
        throw error;
      }
    } else {
      await requireAppAdmin();
      await updateAppUserCredentials({
        userId,
        username,
        password: nextPassword,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao redefinir senha.";
    destination = `/admin?password_error=${encodeURIComponent(message)}`;
  }

  revalidatePath("/admin");
  redirect(destination);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    csv_done?: string;
    csv_inserted?: string;
    csv_updated?: string;
    csv_skipped?: string;
    csv_error?: string;
    score_status?: string;
    score_stage?: string;
    score_group?: string;
    score_round?: string;
    score_page?: string;
    password_reset?: string;
    password_error?: string;
  }>;
}) {
  const viewer = await requireAuthenticatedViewer();
  if (!viewer.isAdmin) {
    redirect("/");
  }

  const query = await searchParams;
  const [matches, profiles] = await Promise.all([getMatches(), getProfiles()]);
  const mode = getStorageMode();
  const csvDone = toSafeQueryValue(query.csv_done) === "1";
  const csvInserted = toSafeCount(query.csv_inserted);
  const csvUpdated = toSafeCount(query.csv_updated);
  const csvSkipped = toSafeCount(query.csv_skipped);
  const csvError = toSafeQueryValue(query.csv_error);
  const passwordReset = toSafeQueryValue(query.password_reset) === "1";
  const passwordError = toSafeQueryValue(query.password_error);
  const scoreStatus = toScoreStatusFilter(query.score_status);
  const scoreStage = toSafeQueryValue(query.score_stage) || "all";
  const scoreGroup = toSafeQueryValue(query.score_group) || "all";
  const scoreRound = toSafeQueryValue(query.score_round) || "all";
  const requestedScorePage = toPositivePage(query.score_page);

  const closedMatches = matches.filter((match) => match.isClosed);
  const activeUsers = profiles.filter((profile) => profile.isActive);
  const sortedMatches = [...matches].sort(
    (left, right) =>
      new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(),
  );
  const scoreOptions = buildScoreOptions(sortedMatches);
  const stageAllowList = new Set(scoreOptions.stage);

  const filteredScoreMatches = sortedMatches.filter((match) => {
    if (scoreStatus === "open" && match.isClosed) {
      return false;
    }
    if (scoreStatus === "closed" && !match.isClosed) {
      return false;
    }

    if (scoreStage !== "all") {
      if (!stageAllowList.has(scoreStage as MatchStage)) {
        return false;
      }
      if (match.stage !== scoreStage) {
        return false;
      }
    }

    if (scoreGroup !== "all" && match.groupName !== scoreGroup) {
      return false;
    }

    if (scoreRound !== "all") {
      const parsedRound = Number.parseInt(scoreRound, 10);
      if (!Number.isInteger(parsedRound) || parsedRound <= 0) {
        return false;
      }
      if (match.roundNumber !== parsedRound) {
        return false;
      }
    }

    return true;
  });

  const scoreTotalPages = Math.max(
    1,
    Math.ceil(filteredScoreMatches.length / SCORE_PAGE_SIZE),
  );
  const scoreCurrentPage = Math.min(requestedScorePage, scoreTotalPages);
  const scoreStart = (scoreCurrentPage - 1) * SCORE_PAGE_SIZE;
  const scoreVisibleMatches = filteredScoreMatches.slice(
    scoreStart,
    scoreStart + SCORE_PAGE_SIZE,
  );

  const scoreQueryBase = new URLSearchParams();
  if (scoreStatus !== "all") {
    scoreQueryBase.set("score_status", scoreStatus);
  }
  if (scoreStage !== "all") {
    scoreQueryBase.set("score_stage", scoreStage);
  }
  if (scoreGroup !== "all") {
    scoreQueryBase.set("score_group", scoreGroup);
  }
  if (scoreRound !== "all") {
    scoreQueryBase.set("score_round", scoreRound);
  }

  const previousPageQuery = new URLSearchParams(scoreQueryBase);
  previousPageQuery.set("score_page", String(Math.max(1, scoreCurrentPage - 1)));
  const nextPageQuery = new URLSearchParams(scoreQueryBase);
  nextPageQuery.set("score_page", String(Math.min(scoreTotalPages, scoreCurrentPage + 1)));

  return (
    <AppShell
      title="Painel Admin"
      subtitle="Gestao completa de jogos, resultados, rodadas e contas da plataforma"
      viewer={viewer}
    >
      <div className="space-y-5">
        {mode !== "supabase" ? (
          <Surface className="border-blue-300/35 bg-blue-500/15 p-3">
            <p className="text-sm text-blue-100">
              Modo local ativo: dados vindos do seu banco proprio (SQLite ou PostgreSQL).
            </p>
          </Surface>
        ) : null}

        {csvDone ? (
          <Surface className="border-emerald-300/35 bg-emerald-500/15 p-3">
            <p className="text-sm text-emerald-100">
              Importacao concluida. Inseridos: {csvInserted} | Atualizados: {csvUpdated} | Com
              aviso/erro: {csvSkipped}.
            </p>
            {csvError ? (
              <p className="mt-1 text-xs text-amber-100">{csvError}</p>
            ) : null}
          </Surface>
        ) : null}

        {!csvDone && csvError ? (
          <Surface className="border-red-300/35 bg-red-500/15 p-3">
            <p className="text-sm text-red-100">{csvError}</p>
          </Surface>
        ) : null}

        {passwordReset ? (
          <Surface className="border-emerald-300/35 bg-emerald-500/15 p-3">
            <p className="text-sm text-emerald-100">Senha redefinida com sucesso.</p>
          </Surface>
        ) : null}

        {passwordError ? (
          <Surface className="border-red-300/35 bg-red-500/15 p-3">
            <p className="text-sm text-red-100">{passwordError}</p>
          </Surface>
        ) : null}

        <section className="grid gap-3 md:grid-cols-4">
          <Surface className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Jogos</p>
            <p className="font-display text-4xl text-white">{matches.length}</p>
          </Surface>
          <Surface className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Encerrados</p>
            <p className="font-display text-4xl text-white">{closedMatches.length}</p>
          </Surface>
          <Surface className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Usuarios ativos</p>
            <p className="font-display text-4xl text-white">{activeUsers.length}</p>
          </Surface>
          <Surface className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Admins</p>
            <p className="font-display text-4xl text-white">
              {profiles.filter((profile) => profile.isAdmin).length}
            </p>
          </Surface>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Surface className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl md:text-3xl uppercase tracking-[0.08em] text-white">
                Cadastrar jogo
              </h2>
              <Badge tone="admin">Match management</Badge>
            </div>
            <form action={createMatch} className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Fase
                <Select name="stage" required defaultValue="group" disabled={!viewer.isAdmin}>
                  {stageOptions.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Grupo (opcional)
                <Input name="group_name" maxLength={20} placeholder="A" disabled={!viewer.isAdmin} />
              </label>
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Numero da partida (opcional)
                <Input
                  type="number"
                  min={1}
                  name="match_number"
                  placeholder="1"
                  disabled={!viewer.isAdmin}
                />
              </label>
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Rodada (opcional)
                <Input
                  type="number"
                  min={1}
                  name="round_number"
                  placeholder="1"
                  disabled={!viewer.isAdmin}
                />
              </label>
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Time mandante
                <Select name="home_team" required defaultValue="Brasil" disabled={!viewer.isAdmin}>
                  {WORLD_CUP_2026_TEAMS.map((team) => (
                    <option key={`home-${team.code}`} value={team.name}>
                      {team.code} - {team.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Time visitante
                <Select
                  name="away_team"
                  required
                  defaultValue="Argentina"
                  disabled={!viewer.isAdmin}
                >
                  {WORLD_CUP_2026_TEAMS.map((team) => (
                    <option key={`away-${team.code}`} value={team.name}>
                      {team.code} - {team.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Data e hora
                <Input type="datetime-local" name="kickoff_at" required disabled={!viewer.isAdmin} />
              </label>
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Estadio (opcional)
                <Input name="venue" placeholder="MetLife Stadium" disabled={!viewer.isAdmin} />
              </label>
              <div className="md:col-span-2">
                <Button type="submit" disabled={!viewer.isAdmin}>
                  Adicionar jogo
                </Button>
              </div>
            </form>
          </Surface>

          <Surface className="p-5">
            <h2 className="font-display text-2xl md:text-3xl uppercase tracking-[0.08em] text-white">
              Ferramentas
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Filtros e modais para operacao de rodada e manutencao rapida.
            </p>
            <div className="mt-4 space-y-3">
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Filtro de fase (visual)
                <Select defaultValue="all">
                  <option value="all">Todas as fases</option>
                  {stageOptions.map((stage) => (
                    <option key={`filter-${stage.value}`} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </Select>
              </label>
              <AdminQuickModal />
            </div>
          </Surface>
        </section>

        <section>
          <Surface className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl md:text-3xl uppercase tracking-[0.08em] text-white">
                Importacao CSV de jogos
              </h2>
              <Badge tone="admin">Bulk import</Badge>
            </div>
            <p className="text-sm text-slate-300">
              Formato: `numero_partida,fase,grupo,rodada,time_casa,time_fora,data_iso,estadio`
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Exemplo: `1,group,A,1,Mexico,Africa do Sul,2026-06-11T19:00:00Z,&quot;Estadio
              Azteca, Cidade do Mexico&quot;`
            </p>

            <form action={importMatchesCsv} className="mt-4 space-y-3">
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Conteudo CSV
                <textarea
                  name="csv_matches"
                  required
                  rows={8}
                  disabled={!viewer.isAdmin}
                  placeholder={'1,group,A,1,Mexico,Africa do Sul,2026-06-11T19:00:00Z,"Estadio Azteca, Cidade do Mexico"'}
                  className="w-full rounded-lg border border-[var(--wb-border)] bg-white px-3 py-2 text-sm text-[var(--wb-text)] outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-[var(--wb-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <Button type="submit" variant="secondary" disabled={!viewer.isAdmin}>
                Importar jogos do CSV
              </Button>
            </form>
          </Surface>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl md:text-3xl uppercase tracking-[0.08em] text-white">
            Gestao de placares
          </h2>
          <Surface className="p-4">
            <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] md:items-end">
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Status
                <Select name="score_status" defaultValue={scoreStatus}>
                  <option value="all">Todos</option>
                  <option value="open">Abertos</option>
                  <option value="closed">Encerrados</option>
                </Select>
              </label>
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Fase
                <Select name="score_stage" defaultValue={scoreStage}>
                  <option value="all">Todas as fases</option>
                  {scoreOptions.stage.map((stage) => (
                    <option key={`score-stage-${stage}`} value={stage}>
                      {STAGE_LABEL[stage]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Grupo
                <Select name="score_group" defaultValue={scoreGroup}>
                  <option value="all">Todos os grupos</option>
                  {scoreOptions.group.map((group) => (
                    <option key={`score-group-${group}`} value={group}>
                      Grupo {group}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                Rodada
                <Select name="score_round" defaultValue={scoreRound}>
                  <option value="all">Todas as rodadas</option>
                  {scoreOptions.round.map((round) => (
                    <option key={`score-round-${round}`} value={String(round)}>
                      Rodada {round}
                    </option>
                  ))}
                </Select>
              </label>
              <Button type="submit" variant="secondary">
                Aplicar filtros
              </Button>
              <Link
                href="/admin"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--wb-border)] px-4 text-sm font-semibold text-[var(--wb-light)] transition-colors hover:bg-white/5"
              >
                Limpar
              </Link>
            </form>
          </Surface>

          <div className="grid gap-3">
            {scoreVisibleMatches.map((match) => (
              <form key={match.id} action={saveOfficialResult}>
                <Surface className="p-4">
                  <input type="hidden" name="match_id" value={match.id} />
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-300">
                        {STAGE_LABEL[match.stage]}
                        {match.groupName ? ` | Grupo ${match.groupName}` : ""}
                        {match.roundNumber ? ` | Rodada ${match.roundNumber}` : ""}
                      </p>
                      <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
                        <TeamPill teamName={match.homeTeam} />
                        <span className="font-display text-3xl text-white">vs</span>
                        <TeamPill teamName={match.awayTeam} align="right" />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-300">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(match.kickoffAt))}
                      </p>
                      <Badge tone={match.isClosed ? "finished" : "upcoming"}>
                        {match.isClosed ? "Encerrado" : "Aberto"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[auto_auto_auto] md:items-end">
                    <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                      Gols {match.homeTeam}
                      <Input
                        type="number"
                        min={0}
                        required
                        name="home_score"
                        defaultValue={match.homeScore ?? 0}
                        className="w-full md:w-24"
                        disabled={!viewer.isAdmin}
                      />
                    </label>
                    <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                      Gols {match.awayTeam}
                      <Input
                        type="number"
                        min={0}
                        required
                        name="away_score"
                        defaultValue={match.awayScore ?? 0}
                        className="w-full md:w-24"
                        disabled={!viewer.isAdmin}
                      />
                    </label>
                    <Button type="submit" variant="success" disabled={!viewer.isAdmin}>
                      Salvar resultado
                    </Button>
                  </div>
                </Surface>
              </form>
            ))}

            {scoreVisibleMatches.length === 0 ? (
              <Surface className="p-4">
                <p className="text-sm text-slate-300">
                  Nenhum jogo encontrado para os filtros selecionados.
                </p>
              </Surface>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <p className="text-slate-300">
              Pagina {scoreCurrentPage} de {scoreTotalPages} | {filteredScoreMatches.length} jogos
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Link
                href={`/admin?${previousPageQuery.toString()}`}
                aria-disabled={scoreCurrentPage <= 1}
                className={`inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition ${
                  scoreCurrentPage <= 1
                    ? "pointer-events-none border-white/10 text-slate-500"
                    : "border-[var(--wb-border)] text-[var(--wb-light)] hover:bg-white/5"
                }`}
              >
                Anterior
              </Link>
              <span className="inline-flex min-w-[44px] items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100">
                {scoreCurrentPage}
              </span>
              <Link
                href={`/admin?${nextPageQuery.toString()}`}
                aria-disabled={scoreCurrentPage >= scoreTotalPages}
                className={`inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition ${
                  scoreCurrentPage >= scoreTotalPages
                    ? "pointer-events-none border-white/10 text-slate-500"
                    : "border-[var(--wb-border)] text-[var(--wb-light)] hover:bg-white/5"
                }`}
              >
                Proxima
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl md:text-3xl uppercase tracking-[0.08em] text-white">
            Reabrir jogos fechados
          </h2>
          <p className="text-sm text-slate-300">
            Remove placar oficial e reabre para edicao de palpite.
          </p>
          <div className="grid gap-2">
            {closedMatches.map((match) => (
              <form key={`reopen-${match.id}`} action={reopenMatch}>
                <Surface className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <input type="hidden" name="match_id" value={match.id} />
                  <p className="text-sm text-slate-100">
                    {match.homeTeam} x {match.awayTeam}
                  </p>
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={!viewer.isAdmin}
                  >
                    Reabrir
                  </Button>
                </Surface>
              </form>
            ))}
            {closedMatches.length === 0 ? (
              <Surface className="p-4">
                <p className="text-sm text-slate-300">Nenhum jogo encerrado para reabrir.</p>
              </Surface>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl md:text-3xl uppercase tracking-[0.08em] text-white">
            Gestao de contas
          </h2>
          <div className="grid gap-2">
            {profiles.map((account) => (
              <Surface
                key={account.id}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-100">{account.displayName}</p>
                  <p className="text-xs text-slate-300">@{account.username}</p>
                  <p className="text-xs text-slate-400">{account.email}</p>
                </div>
                <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                  <Badge tone={account.isAdmin ? "admin" : "neutral"}>
                    {account.isAdmin ? "Admin" : "Usuario"}
                  </Badge>
                  <Badge tone={account.isActive ? "upcoming" : "live"}>
                    {account.isActive ? "Ativo" : "Inativo"}
                  </Badge>

                  <form action={updateAccountAdmin}>
                    <input type="hidden" name="user_id" value={account.id} />
                    <input
                      type="hidden"
                      name="next_admin"
                      value={account.isAdmin ? "false" : "true"}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      className="w-full sm:w-auto"
                      disabled={!viewer.isAdmin}
                    >
                      {account.isAdmin ? "Remover admin" : "Tornar admin"}
                    </Button>
                  </form>

                  <form action={updateAccountStatus}>
                    <input type="hidden" name="user_id" value={account.id} />
                    <input
                      type="hidden"
                      name="next_active"
                      value={account.isActive ? "false" : "true"}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      disabled={!viewer.isAdmin}
                    >
                      {account.isActive ? "Desativar" : "Reativar"}
                    </Button>
                  </form>
                </div>
                <form
                  action={resetAccountPassword}
                  className="grid w-full gap-2 border-t border-white/10 pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                >
                  <input type="hidden" name="user_id" value={account.id} />
                  <input type="hidden" name="username" value={account.username} />
                  <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                    Nova senha
                    <Input
                      type="password"
                      name="password"
                      minLength={6}
                      placeholder="******"
                      disabled={!viewer.isAdmin}
                    />
                  </label>
                  <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
                    Confirmar senha
                    <Input
                      type="password"
                      name="confirm_password"
                      minLength={6}
                      placeholder="******"
                      disabled={!viewer.isAdmin}
                    />
                  </label>
                  <Button
                    type="submit"
                    size="sm"
                    variant="danger"
                    className="w-full sm:w-auto"
                    disabled={!viewer.isAdmin}
                  >
                    Resetar senha
                  </Button>
                </form>
              </Surface>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
