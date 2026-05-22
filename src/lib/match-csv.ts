import type { MatchStage } from "@/lib/types";

export interface CsvMatchImportRow {
  matchNumber: number;
  stage: MatchStage;
  groupName: string | null;
  roundNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string | null;
}

export interface CsvImportIssue {
  line: number;
  message: string;
}

export interface CsvImportParseResult {
  rows: CsvMatchImportRow[];
  issues: CsvImportIssue[];
}

const STAGE_ALIASES: Record<string, MatchStage> = {
  group: "group",
  groups: "group",
  fasegrupos: "group",
  groupstage: "group",
  roundof32: "round_of_32",
  trintaedoisavos: "round_of_32",
  roundof16: "round_of_16",
  oitavas: "round_of_16",
  quartas: "quarterfinal",
  quarterfinal: "quarterfinal",
  semifinal: "semifinal",
  thirdplace: "third_place",
  terceiro: "third_place",
  final: "final",
};

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseCsvLine(line: string): string[] {
  const columns: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      const nextChar = line[index + 1];
      if (insideQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      columns.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  columns.push(current.trim());
  return columns;
}

function parseOptionalPositiveInt(raw: string): number | null | "invalid" {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return "invalid";
  }
  return parsed;
}

function parseRequiredPositiveInt(raw: string): number | "invalid" {
  const parsed = parseOptionalPositiveInt(raw);
  if (parsed === null || parsed === "invalid") {
    return "invalid";
  }
  return parsed;
}

function parseStage(raw: string): MatchStage | null {
  const normalized = normalizeToken(raw);
  if (!normalized) {
    return null;
  }
  return STAGE_ALIASES[normalized] ?? null;
}

function isHeaderRow(columns: string[]): boolean {
  if (columns.length === 0) {
    return false;
  }

  const first = normalizeToken(columns[0] ?? "");
  const second = normalizeToken(columns[1] ?? "");
  return (
    first === "id" ||
    first === "matchnumber" ||
    first === "numero" ||
    second === "stage" ||
    second === "fase"
  );
}

export function parseMatchesCsv(input: string): CsvImportParseResult {
  const rows: CsvMatchImportRow[] = [];
  const issues: CsvImportIssue[] = [];

  const lines = input.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const sourceLine = lines[index];
    const lineNumber = index + 1;

    if (!sourceLine || !sourceLine.trim()) {
      continue;
    }

    const columns = parseCsvLine(sourceLine);
    if (isHeaderRow(columns)) {
      continue;
    }

    if (columns.length < 7) {
      issues.push({
        line: lineNumber,
        message: "Linha invalida: esperado ao menos 7 colunas.",
      });
      continue;
    }

    const matchNumber = parseRequiredPositiveInt(columns[0] ?? "");
    if (matchNumber === "invalid") {
      issues.push({
        line: lineNumber,
        message: "Numero da partida invalido na primeira coluna.",
      });
      continue;
    }

    const stage = parseStage(columns[1] ?? "");
    if (!stage) {
      issues.push({
        line: lineNumber,
        message: "Fase invalida. Use: group, round_of_32, round_of_16, quarterfinal, semifinal, third_place ou final.",
      });
      continue;
    }

    const groupRaw = (columns[2] ?? "").trim();
    const groupName = groupRaw ? groupRaw : null;

    const roundNumberRaw = parseOptionalPositiveInt(columns[3] ?? "");
    if (roundNumberRaw === "invalid") {
      issues.push({
        line: lineNumber,
        message: "Rodada invalida. Use inteiro positivo ou deixe em branco.",
      });
      continue;
    }

    const homeTeam = String(columns[4] ?? "").trim();
    const awayTeam = String(columns[5] ?? "").trim();
    if (!homeTeam || !awayTeam) {
      issues.push({
        line: lineNumber,
        message: "Times mandante e visitante sao obrigatorios.",
      });
      continue;
    }
    if (normalizeToken(homeTeam) === normalizeToken(awayTeam)) {
      issues.push({
        line: lineNumber,
        message: "Times mandante e visitante nao podem ser iguais.",
      });
      continue;
    }

    const kickoffRaw = String(columns[6] ?? "").trim();
    const kickoffDate = new Date(kickoffRaw);
    if (Number.isNaN(kickoffDate.getTime())) {
      issues.push({
        line: lineNumber,
        message: "Data/hora invalida. Use ISO-8601, por exemplo 2026-06-11T19:00:00Z.",
      });
      continue;
    }

    const venueRaw = columns.length > 7 ? columns.slice(7).join(",") : "";
    const venue = venueRaw.trim() ? venueRaw.trim() : null;

    rows.push({
      matchNumber,
      stage,
      groupName,
      roundNumber: roundNumberRaw,
      homeTeam,
      awayTeam,
      kickoffAt: kickoffDate.toISOString(),
      venue,
    });
  }

  if (rows.length === 0 && issues.length === 0) {
    issues.push({
      line: 0,
      message: "Nenhuma linha valida encontrada no CSV.",
    });
  }

  return { rows, issues };
}
