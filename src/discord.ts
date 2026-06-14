import type { ChampionImage, GeminiAnswer, SourceLink } from "./types";
import { escapeMarkdownLabel, truncate } from "./utils";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const EMBED_COLOR = 0x7c3aed;

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

function sourcesMarkdown(sources: SourceLink[], searchQueries: string[]): string | null {
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

  if (lines.length === 0 && searchQueries.length > 0) {
    const query = searchQueries[0];
    if (query) {
      lines.push(`[Ver pesquisa relacionada no Google](https://www.google.com/search?q=${encodeURIComponent(query)})`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

export function buildSuccessMessage(params: {
  question: string;
  answer: GeminiAnswer;
  image?: ChampionImage | null;
  model: string;
}): DiscordMessagePayload {
  const sourceText = sourcesMarkdown(params.answer.sources, params.answer.searchQueries);
  const description = truncate(params.answer.text, 3900);
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (sourceText) {
    fields.push({
      name: "Fontes",
      value: sourceText
    });
  }

  const embed: DiscordEmbed = {
    title: params.image ? `🔮 Oráculo — ${params.image.championName}` : "🔮 Oráculo",
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
