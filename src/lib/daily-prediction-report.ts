import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const GMT_MINUS_3_OFFSET_MS = 3 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

interface MatchRow {
  id: string;
  stage: string;
  group_name: string | null;
  match_number: number | null;
  round_number: number | null;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  venue: string | null;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string;
  email: string;
}

interface PredictionRow {
  user_id: string;
  match_id: string;
  home_goals: number;
  away_goals: number;
}

interface DailyReportRow {
  id: string;
  local_date: string;
  report_csv: string | null;
  report_url: string | null;
  report_sent_at: string | null;
  telegram_message_id: string | null;
  status: string;
}

export interface DailyPredictionLockResult {
  status: "not_configured" | "no_matches" | "not_due" | "already_sent" | "generated" | "sent" | "error";
  localDate: string;
  message: string;
  reportId?: string;
  reportUrl?: string | null;
  telegramMessageId?: string | null;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getGmtMinus3DateKey(value: Date): string {
  return new Date(value.getTime() - GMT_MINUS_3_OFFSET_MS).toISOString().slice(0, 10);
}

function getUtcWindowForLocalDate(localDate: string): { startUtc: string; endUtc: string } {
  return {
    startUtc: `${localDate}T03:00:00.000Z`,
    endUtc: `${addDays(localDate, 1)}T03:00:00.000Z`,
  };
}

function formatLocalDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildCsv(params: {
  localDate: string;
  firstMatch: MatchRow;
  lockDeadlineAt: string;
  matches: MatchRow[];
  profiles: ProfileRow[];
  predictions: PredictionRow[];
}): string {
  const predictionByUserAndMatch = new Map<string, PredictionRow>();
  for (const prediction of params.predictions) {
    predictionByUserAndMatch.set(`${prediction.user_id}:${prediction.match_id}`, prediction);
  }

  const lines: string[] = [
    `Extrato de palpites - ${params.localDate} GMT-3`,
    `Fechamento,${formatLocalDateTime(params.lockDeadlineAt)}`,
    `Primeiro jogo,${params.firstMatch.home_team} x ${params.firstMatch.away_team}`,
    "",
  ];

  const header = [
    "Usuario",
    "Username",
    ...params.matches.map((match) => {
      const group = match.group_name ? `Grupo ${match.group_name}` : match.stage;
      const round = match.round_number ? ` Rodada ${match.round_number}` : "";
      return `${match.home_team} x ${match.away_team} (${group}${round})`;
    }),
  ];
  lines.push(header.map(csvCell).join(","));

  for (const profile of params.profiles) {
    const row = [
      profile.display_name,
      profile.username ?? profile.email,
      ...params.matches.map((match) => {
        const prediction = predictionByUserAndMatch.get(`${profile.id}:${match.id}`);
        return prediction ? `${prediction.home_goals} x ${prediction.away_goals}` : "N/A";
      }),
    ];
    lines.push(row.map(csvCell).join(","));
  }

  return lines.join("\n");
}

async function uploadReport(params: {
  client: SupabaseClient;
  localDate: string;
  reportId: string;
  csv: string;
}): Promise<string | null> {
  const bucket = process.env.REPORT_STORAGE_BUCKET?.trim();
  if (!bucket) {
    return null;
  }

  const path = `palpites-${params.localDate}-${params.reportId}.csv`;
  const { error } = await params.client.storage.from(bucket).upload(path, params.csv, {
    contentType: "text/csv; charset=utf-8",
    upsert: true,
  });

  if (error) {
    throw new Error(`Falha ao salvar CSV no Storage: ${error.message}`);
  }

  const { data } = params.client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function sendTelegramMessage(params: {
  localDate: string;
  matchesCount: number;
  lockDeadlineAt: string;
  reportUrl: string | null;
}): Promise<string | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    return null;
  }

  const reportLine = params.reportUrl
    ? `Relatorio CSV: ${params.reportUrl}`
    : "Relatorio CSV gerado e salvo no banco.";
  const body = [
    `WorldBet 26 - Extrato de palpites ${params.localDate}`,
    `Palpites fechados as ${formatLocalDateTime(params.lockDeadlineAt)} GMT-3.`,
    `Jogos fechados: ${params.matchesCount}.`,
    reportLine,
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: body,
      disable_web_page_preview: !params.reportUrl,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; result?: { message_id?: number }; description?: string }
    | null;

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.description ?? "Falha ao enviar Telegram.");
  }

  return payload?.result?.message_id ? String(payload.result.message_id) : null;
}

export async function processDailyPredictionLock(
  client: SupabaseClient,
  now: Date = new Date(),
): Promise<DailyPredictionLockResult> {
  const localDate = getGmtMinus3DateKey(now);
  const { startUtc, endUtc } = getUtcWindowForLocalDate(localDate);

  const matchesResult = await client
    .from("matches")
    .select("id,stage,group_name,match_number,round_number,home_team,away_team,kickoff_at,venue")
    .gte("kickoff_at", startUtc)
    .lt("kickoff_at", endUtc)
    .order("kickoff_at", { ascending: true });

  if (matchesResult.error) {
    throw new Error(matchesResult.error.message);
  }

  const matches = (matchesResult.data ?? []) as MatchRow[];
  if (matches.length === 0) {
    return {
      status: "no_matches",
      localDate,
      message: "Nenhum jogo encontrado para o dia GMT-3.",
    };
  }

  const firstMatch = matches[0];
  const lockDeadlineAt = new Date(new Date(firstMatch.kickoff_at).getTime() - ONE_HOUR_MS);
  if (now.getTime() < lockDeadlineAt.getTime()) {
    return {
      status: "not_due",
      localDate,
      message: `Fechamento ainda nao venceu. Prazo: ${lockDeadlineAt.toISOString()}.`,
    };
  }

  const existingResult = await client
    .from("daily_prediction_reports")
    .select("id,local_date,report_csv,report_url,report_sent_at,telegram_message_id,status")
    .eq("local_date", localDate)
    .maybeSingle();

  if (existingResult.error) {
    throw new Error(existingResult.error.message);
  }

  const existing = existingResult.data as DailyReportRow | null;
  if (existing?.report_sent_at) {
    return {
      status: "already_sent",
      localDate,
      message: "Relatorio diario ja enviado.",
      reportId: existing.id,
      reportUrl: existing.report_url,
      telegramMessageId: existing.telegram_message_id,
    };
  }

  let reportId = existing?.id;
  let reportCsv = existing?.report_csv ?? null;
  let reportUrl = existing?.report_url ?? null;

  if (!reportId || !reportCsv) {
    const [profilesResult, predictionsResult] = await Promise.all([
      client
        .from("profiles")
        .select("id,username,display_name,email")
        .eq("is_active", true)
        .order("display_name", { ascending: true }),
      client
        .from("predictions")
        .select("user_id,match_id,home_goals,away_goals")
        .in(
          "match_id",
          matches.map((match) => match.id),
        ),
    ]);

    if (profilesResult.error) {
      throw new Error(profilesResult.error.message);
    }
    if (predictionsResult.error) {
      throw new Error(predictionsResult.error.message);
    }

    reportCsv = buildCsv({
      localDate,
      firstMatch,
      lockDeadlineAt: lockDeadlineAt.toISOString(),
      matches,
      profiles: (profilesResult.data ?? []) as ProfileRow[],
      predictions: (predictionsResult.data ?? []) as PredictionRow[],
    });

    const insertResult = await client
      .from("daily_prediction_reports")
      .insert({
        local_date: localDate,
        first_match_id: firstMatch.id,
        first_kickoff_at: firstMatch.kickoff_at,
        lock_deadline_at: lockDeadlineAt.toISOString(),
        locked_at: now.toISOString(),
        report_generated_at: now.toISOString(),
        report_csv: reportCsv,
        report_json: {
          match_ids: matches.map((match) => match.id),
          matches_count: matches.length,
        },
        telegram_chat_id: process.env.TELEGRAM_CHAT_ID?.trim() ?? null,
        status: "generated",
      })
      .select("id")
      .maybeSingle();

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        return processDailyPredictionLock(client, now);
      }
      throw new Error(insertResult.error.message);
    }

    if (!insertResult.data?.id) {
      throw new Error("Relatorio criado sem id retornado.");
    }

    reportId = String(insertResult.data.id);

    const updateMatchesResult = await client
      .from("matches")
      .update({ predictions_closed_at: now.toISOString() })
      .in(
        "id",
        matches.map((match) => match.id),
      )
      .is("predictions_closed_at", null);

    if (updateMatchesResult.error) {
      throw new Error(updateMatchesResult.error.message);
    }

    reportUrl = await uploadReport({
      client,
      localDate,
      reportId,
      csv: reportCsv,
    });

    if (reportUrl) {
      await client
        .from("daily_prediction_reports")
        .update({ report_url: reportUrl })
        .eq("id", reportId);
    }
  }

  if (!reportId || !reportCsv) {
    throw new Error("Relatorio diario nao esta disponivel para envio.");
  }

  try {
    const telegramMessageId = await sendTelegramMessage({
      localDate,
      matchesCount: matches.length,
      lockDeadlineAt: lockDeadlineAt.toISOString(),
      reportUrl,
    });

    const sentAt = telegramMessageId ? now.toISOString() : null;
    await client
      .from("daily_prediction_reports")
      .update({
        report_sent_at: sentAt,
        telegram_message_id: telegramMessageId,
        report_url: reportUrl,
        status: telegramMessageId ? "sent" : "generated",
        error_message: telegramMessageId
          ? null
          : "Telegram nao configurado; relatorio gerado sem envio.",
      })
      .eq("id", reportId);

    return {
      status: telegramMessageId ? "sent" : "generated",
      localDate,
      message: telegramMessageId
        ? "Relatorio gerado e enviado no Telegram."
        : "Relatorio gerado; envio Telegram aguardando configuracao.",
      reportId,
      reportUrl,
      telegramMessageId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar Telegram.";
    await client
      .from("daily_prediction_reports")
      .update({
        status: "error",
        error_message: message,
        report_url: reportUrl,
      })
      .eq("id", reportId);

    return {
      status: "error",
      localDate,
      message,
      reportId,
      reportUrl,
    };
  }
}
