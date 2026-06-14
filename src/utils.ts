import type { RiotId, SourceLink } from "./types";

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function extractRiotId(question: string): RiotId | null {
  const match = question.match(/(?:^|\s|["'`(])([^\s#"'`(),]{2,24})#([\p{L}\p{N}]{2,8})(?=$|\s|["'`).,!?])/iu);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    gameName: match[1].trim(),
    tagLine: match[2].trim()
  };
}

export function isAllowedGuild(guildId: string | undefined, configuredIds: string | undefined): boolean {
  const ids = (configuredIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return true;
  }

  return Boolean(guildId && ids.includes(guildId));
}

export function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  return ["1", "true", "yes", "sim", "on"].includes(value.trim().toLowerCase());
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function uniqueSources(sources: SourceLink[], limit = 5): SourceLink[] {
  const seen = new Set<string>();
  const result: SourceLink[] = [];

  for (const source of sources) {
    if (!source.uri || seen.has(source.uri)) {
      continue;
    }

    seen.add(source.uri);
    result.push(source);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}m${remaining.toString().padStart(2, "0")}s`;
}

export function formatSaoPauloDate(date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function escapeMarkdownLabel(value: string): string {
  return value.replace(/[\[\]]/g, "").trim();
}
