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

export function extractRiotIds(question: string): RiotId[] {
  // Riot game names têm até 16 caracteres e podem conter espaços, então
  // capturamos a maior sequência válida antes do "#tag". Como em texto livre
  // não dá para saber onde o nome começa, geramos candidatos do mais
  // específico (nome completo) ao mais curto (removendo palavras iniciais) e
  // deixamos a consulta à Riot escolher o que existe de fato.
  const match = question.match(
    /(?:^|[\s"'`(])([\p{L}\p{N}][\p{L}\p{N} ]{1,15})#([\p{L}\p{N}]{2,5})(?=$|[\s"'`).,!?])/u
  );
  if (!match?.[1] || !match[2]) {
    return [];
  }

  const tagLine = match[2].trim();
  const words = match[1].trim().replace(/\s+/g, " ").split(" ");

  const candidates: RiotId[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const gameName = words.slice(i).join(" ");
    if (gameName.length >= 2) {
      candidates.push({ gameName, tagLine });
    }
  }

  return candidates;
}

// Detecta se a pergunta pede uma fila específica para separar as partidas.
export function detectQueue(question: string): { ids: number[]; label: string } | null {
  const normalized = normalizeText(question);
  if (/\baram\b/.test(normalized)) {
    return { ids: [450], label: "ARAM" };
  }
  if (/\b(ranqueada|ranqueado|ranked|rankeada|elo|soloq|solo q|flex)\b/.test(normalized)) {
    return { ids: [420, 440], label: "Ranqueada" };
  }
  if (/\bnorma(l|is|les)\b/.test(normalized) || /\bnorm\b/.test(normalized)) {
    return { ids: [400, 430, 490], label: "Normal" };
  }
  return null;
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

export function toInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
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

// Detecta se a pergunta pede um resumo de histórico (melhor campeão, desempenho geral, etc.)
export function detectHistoryIntent(question: string): boolean {
  const n = normalizeText(question);
  return (
    /\b(historico|desempenho|estatisticas|winrate|performance)\b/.test(n) ||
    n.includes("jogo melhor") ||
    n.includes("melhor de que") ||
    n.includes("melhor campeao") ||
    n.includes("mais jogado") ||
    n.includes("win rate") ||
    n.includes("mais joguei") ||
    n.includes("mais jogo") ||
    n.includes("mais vitorias") ||
    n.includes("mais wins")
  );
}

export function detectPersonalStatsIntent(question: string): boolean {
  const n = normalizeText(question);
  return (
    detectHistoryIntent(question) ||
    /\b(melhor|melhores|maior|maiores|top)\b/.test(n) &&
      /\b(campeao|campeoes|champ|champs|partida|partidas|kda|kills|cs|farm|visao|vision|player|players)\b/.test(n)
  );
}

export function detectBestMatchIntent(question: string): boolean {
  const n = normalizeText(question);
  return /\b(partida|partidas|game|games|kda|kills|cs|farm|visao|vision)\b/.test(n);
}

export function detectBuildOrCurrentInfoIntent(question: string): boolean {
  const n = normalizeText(question);
  return /\b(build|item|itens|runa|runas|patch|nota|notas|noticia|noticias|tier|meta|pick|picks|counter|matchup|pro|pros|dica|dicas|reddit)\b/.test(n);
}

// Extrai Steam ID64 de texto livre (para busca de histórico no Deadlock).
export function extractSteamId(question: string): string | null {
  const direct = question.match(/\b(7656119\d{10})\b/);
  if (direct?.[1]) return direct[1];

  const fromUrl = question.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (fromUrl?.[1]) return fromUrl[1];

  return null;
}
