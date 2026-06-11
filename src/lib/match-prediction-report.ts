import "server-only";

import { Pool, type PoolClient } from "pg";

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

declare global {
  // Reused across invocations on Vercel.
  var __bolaoMatchReportPool: Pool | undefined;
}

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    return null;
  }

  if (!globalThis.__bolaoMatchReportPool) {
    const sslSetting = process.env.DATABASE_SSL?.trim().toLowerCase();
    const useSsl =
      sslSetting === "true" || (sslSetting !== "false" && connectionString.includes("supabase.co"));

    globalThis.__bolaoMatchReportPool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  return globalThis.__bolaoMatchReportPool;
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
    : "Relatorio CSV salvo no banco.";
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
  client: PoolClient,
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

  const existingResult = await client.query<MatchReportRow>(
    `
      SELECT id, match_id, report_csv, report_url, report_sent_at, telegram_message_id, status
      FROM public.match_prediction_reports
      WHERE match_id = $1
      LIMIT 1
    `,
    [match.id],
  );

  const existing = existingResult.rows[0] ?? null;
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

  let reportId = existing?.id ?? null;
  let reportCsv = existing?.report_csv ?? null;
  const reportUrl = existing?.report_url ?? null;

  if (!reportId || !reportCsv) {
    const [profilesResult, predictionsResult] = await Promise.all([
      client.query<ProfileRow>(
        `
          SELECT id, username, display_name, email
          FROM public.profiles
          WHERE is_active = true
          ORDER BY display_name ASC
        `,
      ),
      client.query<PredictionRow>(
        `
          SELECT user_id, match_id, home_goals, away_goals
          FROM public.predictions
          WHERE match_id = $1
        `,
        [match.id],
      ),
    ]);

    reportCsv = buildCsv({
      match,
      lockDeadlineAt: lockDeadlineAt.toISOString(),
      profiles: profilesResult.rows,
      predictions: predictionsResult.rows,
    });

    const inserted = await client.query<{ id: string }>(
      `
        INSERT INTO public.match_prediction_reports (
          match_id,
          lock_deadline_at,
          locked_at,
          report_generated_at,
          report_csv,
          report_json,
          telegram_chat_id,
          status
        )
        VALUES ($1, $2, $3, $3, $4, $5::jsonb, $6, 'generated')
        ON CONFLICT (match_id)
        DO UPDATE SET
          lock_deadline_at = EXCLUDED.lock_deadline_at,
          locked_at = EXCLUDED.locked_at,
          report_generated_at = EXCLUDED.report_generated_at,
          report_csv = EXCLUDED.report_csv,
          report_json = EXCLUDED.report_json,
          telegram_chat_id = EXCLUDED.telegram_chat_id,
          status = 'generated'
        RETURNING id
      `,
      [
        match.id,
        lockDeadlineAt.toISOString(),
        now.toISOString(),
        reportCsv,
        JSON.stringify({
          match_id: match.id,
          match_number: match.match_number,
          home_team: match.home_team,
          away_team: match.away_team,
        }),
        process.env.TELEGRAM_CHAT_ID?.trim() ?? null,
      ],
    );

    reportId = inserted.rows[0]?.id ?? reportId;

    await client.query(
      `
        UPDATE public.matches
        SET predictions_closed_at = $1
        WHERE id = $2
          AND predictions_closed_at IS NULL
      `,
      [now.toISOString(), match.id],
    );
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

    await client.query(
      `
        UPDATE public.match_prediction_reports
        SET
          report_sent_at = $1,
          telegram_message_id = $2,
          report_url = $3,
          status = $4,
          error_message = $5
        WHERE id = $6
      `,
      [
        telegramMessageId ? now.toISOString() : null,
        telegramMessageId,
        reportUrl,
        telegramMessageId ? "sent" : "generated",
        telegramMessageId ? null : "Telegram nao configurado; relatorio gerado sem envio.",
        reportId,
      ],
    );

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
    await client.query(
      `
        UPDATE public.match_prediction_reports
        SET status = 'error', error_message = $1, report_url = $2
        WHERE id = $3
      `,
      [message, reportUrl, reportId],
    );

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
  _unusedClient: unknown,
  now: Date = new Date(),
): Promise<ProcessMatchPredictionLocksResult> {
  const pool = getPool();
  if (!pool) {
    return {
      status: "error",
      message: "Configure DATABASE_URL para executar o cron sem Supabase API keys.",
      processed: [],
    };
  }

  const client = await pool.connect();
  try {
    const dueUntil = new Date(now.getTime() + ONE_HOUR_MS).toISOString();
    const matchesResult = await client.query<MatchRow>(
      `
        SELECT id, stage, group_name, match_number, round_number, home_team, away_team, kickoff_at, venue
        FROM public.matches
        WHERE kickoff_at <= $1
          AND predictions_closed_at IS NULL
          AND is_closed = false
        ORDER BY kickoff_at ASC
        LIMIT 12
      `,
      [dueUntil],
    );

    if (matchesResult.rows.length === 0) {
      return {
        status: "no_matches",
        message: "Nenhum jogo pendente de fechamento.",
        processed: [],
      };
    }

    const processed: MatchPredictionLockResult[] = [];
    for (const match of matchesResult.rows) {
      processed.push(await processMatchPredictionLock(client, match, now));
    }

    const hasError = processed.some((result) => result.status === "error");
    return {
      status: hasError ? "error" : "processed",
      message: `${processed.length} jogo(s) processado(s).`,
      processed,
    };
  } finally {
    client.release();
  }
}
