import type {
  ChampionImage,
  DeadlockPlayerSummary,
  GeminiAnswer,
  MatchHistorySummary,
  RiotMatchSummary,
  RiotPentaResult,
  SourceLink
} from "./types";
import { escapeMarkdownLabel, formatDuration, truncate } from "./utils";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const EMBED_COLOR = 0x7c3aed;

type EmbedField = { name: string; value: string; inline?: boolean };

const QUEUE_LABELS: Record<number, string> = {
  400: "Normal Draft",
  420: "Ranqueada Solo/Duo",
  430: "Normal Blind",
  440: "Ranqueada Flex",
  450: "ARAM",
  490: "Normal (Quickplay)",
  700: "Clash",
  1700: "Arena",
  1900: "URF"
};

function queueLabel(queueId: number, gameMode: string): string {
  return QUEUE_LABELS[queueId] ?? gameMode ?? "Partida";
}

// Ids do Data Dragon que não batem com o slug de OP.GG/U.GG.
const CHAMPION_SLUG_OVERRIDES: Record<string, string> = {
  monkeyking: "wukong"
};

function championSlug(id: string): string {
  const slug = id.toLowerCase().replace(/[^a-z0-9]/g, "");
  return CHAMPION_SLUG_OVERRIDES[slug] ?? slug;
}

function championLinksField(image: ChampionImage): EmbedField {
  const slug = championSlug(image.id);
  return {
    name: "📈 Builds & stats",
    value: `[OP.GG](https://op.gg/lol/champions/${slug}/build) · [U.GG](https://u.gg/lol/champions/${slug}/build)`
  };
}

function kdaRatio(match: RiotMatchSummary): string {
  if (match.deaths === 0) {
    return "Perfeito";
  }
  return `${((match.kills + match.assists) / match.deaths).toFixed(2)}:1`;
}

// Renderiza os números da Riot direto em campos do embed, de forma determinística
// e bonita, independente do texto que o Gemini escrever.
function matchStatsFields(match: RiotMatchSummary, isPenta: boolean): EmbedField[] {
  const fields: EmbedField[] = [
    { name: "Campeão", value: match.championName, inline: true },
    { name: "Resultado", value: match.win ? "🟢 Vitória" : "🔴 Derrota", inline: true }
  ];

  if (isPenta) {
    fields.push({ name: "Pentakills", value: `🔥 ${match.pentaKills}`, inline: true });
  }

  fields.push(
    { name: "KDA", value: `${match.kills}/${match.deaths}/${match.assists} · ${kdaRatio(match)}`, inline: true },
    { name: "CS", value: String(match.cs), inline: true },
    { name: "Visão", value: String(match.visionScore), inline: true },
    {
      name: "Partida",
      value: `${queueLabel(match.queueId, match.gameMode)} · ${formatDuration(match.gameDurationSeconds)}`,
      inline: true
    }
  );

  if (match.endedAtIso) {
    const unix = Math.floor(new Date(match.endedAtIso).getTime() / 1000);
    if (Number.isFinite(unix)) {
      fields.push({ name: "Quando", value: `<t:${unix}:R>`, inline: true });
    }
  }

  return fields;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  thumbnail?: { url: string };
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordMessagePayload {
  content?: string;
  embeds?: DiscordEmbed[];
  allowed_mentions?: {
    parse: string[];
  };
}

function sourcesMarkdown(sources: SourceLink[]): string | null {
  const lines: string[] = [];

  for (const [index, source] of sources.entries()) {
    const label = truncate(escapeMarkdownLabel(source.title) || `Fonte ${index + 1}`, 80);
    const line = `${index + 1}. [${label}](${source.uri})`;
    const candidate = [...lines, line].join("\n");
    if (candidate.length > 1000) {
      break;
    }
    lines.push(line);
  }

  // Sem links genéricos de busca: só mostramos fontes reais e direcionadas.
  return lines.length > 0 ? lines.join("\n") : null;
}

function matchHistoryFields(summary: MatchHistorySummary): EmbedField[] {
  return summary.champions.slice(0, 5).map((c) => {
    const wr = c.games > 0 ? ((c.wins / c.games) * 100).toFixed(0) : "0";
    const avgKda =
      c.games > 0
        ? `${(c.kills / c.games).toFixed(1)}/${(c.deaths / c.games).toFixed(1)}/${(c.assists / c.games).toFixed(1)}`
        : "–";
    return {
      name: `${c.championName} · ${c.games} jogo${c.games !== 1 ? "s" : ""}`,
      value: `${c.wins}V/${c.games - c.wins}D · ${wr}% WR · KDA ${avgKda}`,
      inline: true
    };
  });
}

function deadlockHistoryFields(summary: DeadlockPlayerSummary): EmbedField[] {
  return summary.heroStats.slice(0, 5).map((h) => {
    const wr = h.matches > 0 ? ((h.wins / h.matches) * 100).toFixed(0) : "0";
    const avgKda =
      h.matches > 0
        ? `${(h.kills / h.matches).toFixed(1)}/${(h.deaths / h.matches).toFixed(1)}/${(h.assists / h.matches).toFixed(1)}`
        : "–";
    return {
      name: `${h.heroName} · ${h.matches} partida${h.matches !== 1 ? "s" : ""}`,
      value: `${h.wins}V/${h.matches - h.wins}D · ${wr}% WR · KDA ${avgKda}`,
      inline: true
    };
  });
}

export function buildSuccessMessage(params: {
  question: string;
  answer: GeminiAnswer;
  image?: ChampionImage | null;
  model: string;
  match?: RiotMatchSummary | null;
  penta?: RiotPentaResult | null;
  matchHistory?: MatchHistorySummary | null;
  deadlockSummary?: DeadlockPlayerSummary | null;
}): DiscordMessagePayload {
  const sourceText = sourcesMarkdown(params.answer.sources);
  const description = truncate(params.answer.text, 3900);
  const fields: EmbedField[] = [];

  // Estatísticas do jogador em destaque (grid), antes do texto-fonte.
  let statTitle: string | null = null;
  if (params.penta?.found && params.penta.match) {
    const queueSuffix = params.penta.queueLabel ? ` · ${params.penta.queueLabel}` : "";
    statTitle = `🔥 Último pentakill — ${params.penta.match.riotId}${queueSuffix}`;
    fields.push(...matchStatsFields(params.penta.match, true));
  } else if (params.penta && !params.penta.found) {
    const queueSuffix = params.penta.queueLabel ? ` (${params.penta.queueLabel})` : "";
    fields.push({
      name: "Pentakill",
      value: `Nenhum nas últimas ${params.penta.scanned} partidas analisadas${queueSuffix}.`
    });
  } else if (params.matchHistory) {
    const queueSuffix = params.matchHistory.queueLabel ? ` · ${params.matchHistory.queueLabel}` : "";
    statTitle = `📊 Histórico — ${params.matchHistory.riotId}${queueSuffix} (${params.matchHistory.totalGames} partidas)`;
    fields.push(...matchHistoryFields(params.matchHistory));
  } else if (params.match) {
    statTitle = `📊 Última partida — ${params.match.riotId}`;
    fields.push(...matchStatsFields(params.match, false));
  } else if (params.deadlockSummary) {
    statTitle = `🎯 Deadlock — histórico (${params.deadlockSummary.totalMatches} partidas)`;
    fields.push(...deadlockHistoryFields(params.deadlockSummary));
  }

  if (params.image) {
    fields.push(championLinksField(params.image));
  }

  if (sourceText) {
    fields.push({ name: "Fontes", value: sourceText });
  }

  const titleChampion = params.penta?.match?.championName ?? params.match?.championName ?? params.image?.championName;
  const embed: DiscordEmbed = {
    title: statTitle ?? (titleChampion ? `🔮 Oráculo — ${titleChampion}` : "🔮 Oráculo"),
    description,
    color: EMBED_COLOR,
    footer: {
      text: `Pergunta: ${truncate(params.question.replace(/\s+/g, " "), 180)} • ${params.model}`
    },
    timestamp: new Date().toISOString()
  };

  if (fields.length > 0) {
    embed.fields = fields;
  }
  if (params.image) {
    embed.thumbnail = { url: params.image.url };
  }

  return {
    embeds: [embed],
    allowed_mentions: { parse: [] }
  };
}

export function buildErrorMessage(error: unknown): DiscordMessagePayload {
  const rawMessage = error instanceof Error ? error.message : "Erro desconhecido";
  return {
    embeds: [
      {
        title: "🔮 O Oráculo falhou ao consultar as fontes",
        description: `${truncate(rawMessage, 1200)}\n\nTente novamente com uma pergunta mais específica.`,
        color: 0xdc2626,
        timestamp: new Date().toISOString()
      }
    ],
    allowed_mentions: { parse: [] }
  };
}

export async function editOriginalInteractionResponse(params: {
  applicationId: string;
  interactionToken: string;
  payload: DiscordMessagePayload;
}): Promise<void> {
  const response = await fetch(
    `${DISCORD_API_BASE}/webhooks/${encodeURIComponent(params.applicationId)}/${encodeURIComponent(
      params.interactionToken
    )}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(params.payload)
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Discord recusou a edição da resposta (${response.status}): ${details.slice(0, 300)}`);
  }
}
