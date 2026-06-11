import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

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

interface MatchReportRow {
  id: string;
  match_id: string;
  report_csv: string | null;
  report_url: string | null;
  report_sent_at: string | null;
  telegram_message_id: string | null;
  status: string;
}

export interface MatchPredictionLockResult {
  status: "not_due" | "already_sent" | "generated" | "sent" | "error";
  matchId: string;
  matchLabel: string;
  message: string;
  reportId?: string;
  reportUrl?: string | null;
  telegramMessageId?: string | null;
}

export interface ProcessMatchPredictionLocksResult {
  status: "no_matches" | "processed" | "error";
  message: string;
  processed: MatchPredictionLockResult[];
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

function getMatchLabel(match: MatchRow): string {
  return `${match.home_team} x ${match.away_team}`;
}

function buildCsv(params: {
  match: MatchRow;
  lockDeadlineAt: string;
  profiles: ProfileRow[];
  predictions: PredictionRow[];
}): string {
  const predictionByUser = new Map<string, PredictionRow>();
  for (const prediction of params.predictions) {
    predictionByUser.set(prediction.user_id, prediction);
  }

  const group = params.match.group_name ? `Grupo ${params.match.group_name}` : params.match.stage;
  const round = params.match.round_number ? `Rodada ${params.match.round_number}` : "";
  const lines: string[] = [
    `Extrato de palpites - ${getMatchLabel(params.match)}`,
    `Fechamento,${formatLocalDateTime(params.lockDeadlineAt)}`,
    `Horario do jogo,${formatLocalDateTime(params.match.kickoff_at)}`,
    `Fase,${[group, round].filter(Boolean).join(" - ")}`,
    `Estadio,${params.match.venue ?? "A definir"}`,
    "",
    ["Usuario", "Username", "Palpite"].map(csvCell).join(","),
  ];

  for (const profile of params.profiles) {
    const prediction = predictionByUser.get(profile.id);
    const row = [
      profile.display_name,
      profile.username ?? profile.email,
      prediction ? `${prediction.home_goals} x ${prediction.away_goals}` : "N/A",
    ];
    lines.push(row.map(csvCell).join(","));
  }

  return lines.join("\n");
}

async function uploadReport(params: {
  client: SupabaseClient;
  match: MatchRow;
  reportId: string;
  csv: string;
}): Promise<string | null> {
  const bucket = process.env.REPORT_STORAGE_BUCKET?.trim();
  if (!bucket) {
    return null;
  }

  const matchNumber = params.match.match_number ?? params.match.id;
  const path = `palpite-jogo-${matchNumber}-${params.reportId}.csv`;
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
  match: MatchRow;
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
    `WorldBet 26 - Palpites fechados`,
    `Jogo: ${getMatchLabel(params.match)}`,
    `Horario: ${formatLocalDateTime(params.match.kickoff_at)}`,
    `Fechamento: ${formatLocalDateTime(params.lockDeadlineAt)}`,
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

async function processMatchPredictionLock(
  client: SupabaseClient,
  match: MatchRow,
  now: Date,
): Promise<MatchPredictionLockResult> {
  const lockDeadlineAt = new Date(new Date(match.kickoff_at).getTime() - ONE_HOUR_MS);
  const matchLabel = getMatchLabel(match);

  if (now.getTime() < lockDeadlineAt.getTime()) {
    return {
      status: "not_due",
      matchId: match.id,
      matchLabel,
      message: `Fechamento ainda nao venceu. Prazo: ${lockDeadlineAt.toISOString()}.`,
    };
  }

  const existingResult = await client
    .from("match_prediction_reports")
    .select("id,match_id,report_csv,report_url,report_sent_at,telegram_message_id,status")
    .eq("match_id", match.id)
    .maybeSingle();

  if (existingResult.error) {
    throw new Error(existingResult.error.message);
  }

  const existing = existingResult.data as MatchReportRow | null;
  if (existing?.report_sent_at) {
    return {
      status: "already_sent",
      matchId: match.id,
      matchLabel,
      message: "Relatorio do jogo ja enviado.",
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
        .eq("match_id", match.id),
    ]);

    if (profilesResult.error) {
      throw new Error(profilesResult.error.message);
    }
    if (predictionsResult.error) {
      throw new Error(predictionsResult.error.message);
    }

    reportCsv = buildCsv({
      match,
      lockDeadlineAt: lockDeadlineAt.toISOString(),
      profiles: (profilesResult.data ?? []) as ProfileRow[],
      predictions: (predictionsResult.data ?? []) as PredictionRow[],
    });

    const insertResult = await client
      .from("match_prediction_reports")
      .insert({
        match_id: match.id,
        lock_deadline_at: lockDeadlineAt.toISOString(),
        locked_at: now.toISOString(),
        report_generated_at: now.toISOString(),
        report_csv: reportCsv,
        report_json: {
          match_id: match.id,
          match_number: match.match_number,
          home_team: match.home_team,
          away_team: match.away_team,
        },
        telegram_chat_id: process.env.TELEGRAM_CHAT_ID?.trim() ?? null,
        status: "generated",
      })
      .select("id")
      .maybeSingle();

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        return processMatchPredictionLock(client, match, now);
      }
      throw new Error(insertResult.error.message);
    }

    if (!insertResult.data?.id) {
      throw new Error("Relatorio criado sem id retornado.");
    }

    reportId = String(insertResult.data.id);

    const updateMatchResult = await client
      .from("matches")
      .update({ predictions_closed_at: now.toISOString() })
      .eq("id", match.id)
      .is("predictions_closed_at", null);

    if (updateMatchResult.error) {
      throw new Error(updateMatchResult.error.message);
    }

    reportUrl = await uploadReport({
      client,
      match,
      reportId,
      csv: reportCsv,
    });

    if (reportUrl) {
      await client
        .from("match_prediction_reports")
        .update({ report_url: reportUrl })
        .eq("id", reportId);
    }
  }

  if (!reportId || !reportCsv) {
    throw new Error("Relatorio do jogo nao esta disponivel para envio.");
  }

  try {
    const telegramMessageId = await sendTelegramMessage({
      match,
      lockDeadlineAt: lockDeadlineAt.toISOString(),
      reportUrl,
    });

    const sentAt = telegramMessageId ? now.toISOString() : null;
    await client
      .from("match_prediction_reports")
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
      matchId: match.id,
      matchLabel,
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
      .from("match_prediction_reports")
      .update({
        status: "error",
        error_message: message,
        report_url: reportUrl,
      })
      .eq("id", reportId);

    return {
      status: "error",
      matchId: match.id,
      matchLabel,
      message,
      reportId,
      reportUrl,
    };
  }
}

export async function processMatchPredictionLocks(
  client: SupabaseClient,
  now: Date = new Date(),
): Promise<ProcessMatchPredictionLocksResult> {
  const dueUntil = new Date(now.getTime() + ONE_HOUR_MS).toISOString();
  const matchesResult = await client
    .from("matches")
    .select("id,stage,group_name,match_number,round_number,home_team,away_team,kickoff_at,venue")
    .lte("kickoff_at", dueUntil)
    .is("predictions_closed_at", null)
    .eq("is_closed", false)
    .order("kickoff_at", { ascending: true })
    .limit(12);

  if (matchesResult.error) {
    throw new Error(matchesResult.error.message);
  }

  const matches = (matchesResult.data ?? []) as MatchRow[];
  if (matches.length === 0) {
    return {
      status: "no_matches",
      message: "Nenhum jogo pendente de fechamento.",
      processed: [],
    };
  }

  const processed: MatchPredictionLockResult[] = [];
  for (const match of matches) {
    processed.push(await processMatchPredictionLock(client, match, now));
  }

  const hasError = processed.some((result) => result.status === "error");
  return {
    status: hasError ? "error" : "processed",
    message: `${processed.length} jogo(s) processado(s).`,
    processed,
  };
}
