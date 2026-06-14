import {
  InteractionResponseType,
  InteractionType,
  verifyKey
} from "discord-interactions";
import { findChampionImage } from "./datadragon";
import {
  buildErrorMessage,
  buildSuccessMessage,
  editOriginalInteractionResponse
} from "./discord";
import { askGemini } from "./gemini";
import { buildGeminiRequest } from "./prompts";
import { getLastPentakill, getLatestLolMatch } from "./riot";
import type { DiscordInteraction, Env, RiotMatchSummary, RiotPentaResult } from "./types";
import { detectQueue, extractRiotIds, isAllowedGuild, normalizeText, toBoolean, truncate } from "./utils";

const ORACLE_COMMAND = "oraculo";
const QUESTION_OPTION = "pergunta";
const MAX_QUESTION_LENGTH = 1200;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function getQuestion(interaction: DiscordInteraction): string | null {
  const option = interaction.data?.options?.find((item) => item.name === QUESTION_OPTION);
  if (typeof option?.value !== "string") {
    return null;
  }

  const question = option.value.trim();
  return question.length > 0 ? question : null;
}

async function processOracle(interaction: DiscordInteraction, question: string, env: Env): Promise<void> {
  const model = env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

  try {
    const riotIds = extractRiotIds(question);
    const apiKey = env.RIOT_API_KEY?.trim();
    const wantsPentakill = /\bpenta/.test(normalizeText(question));

    const questionImagePromise = withTimeout(
      findChampionImage(question),
      5000,
      "Tempo excedido ao consultar imagem do campeão."
    ).catch(() => null);

    let riotMatch: RiotMatchSummary | null = null;
    let penta: RiotPentaResult | null = null;

    if (riotIds.length > 0 && apiKey) {
      const region = env.RIOT_ROUTING_REGION || "americas";
      const queue = detectQueue(question);
      if (wantsPentakill) {
        penta = await withTimeout(
          getLastPentakill(riotIds, apiKey, region, 40, queue?.ids),
          12000,
          "Tempo excedido ao consultar pentakills na API da Riot."
        ).catch((error) => {
          console.warn("Consulta de pentakill à Riot falhou; a resposta seguirá com busca web", error);
          return null;
        });
        if (penta && queue) {
          penta = { ...penta, queueLabel: queue.label };
        }
      } else {
        riotMatch = await withTimeout(
          getLatestLolMatch(riotIds, apiKey, region, queue?.ids),
          queue ? 12000 : 6000,
          "Tempo excedido ao consultar a API da Riot."
        ).catch((error) => {
          console.warn("Consulta à Riot falhou; a resposta seguirá com busca web", error);
          return null;
        });
      }
    }

    const questionImage = await questionImagePromise;
    const matchForImage = penta?.match ?? riotMatch;
    const image =
      matchForImage && !questionImage
        ? await withTimeout(
            findChampionImage(matchForImage.championName),
            3000,
            "Tempo excedido ao consultar imagem da partida."
          ).catch(() => null)
        : questionImage;
    const prompt = buildGeminiRequest(question, riotMatch, penta);

    const answer = await askGemini({
      apiKey: env.GEMINI_API_KEY,
      model,
      systemInstruction: prompt.systemInstruction,
      prompt: prompt.userPrompt,
      enableGoogleSearch: toBoolean(env.ENABLE_GOOGLE_SEARCH, true),
      timeoutMs: 18000
    });

    await editOriginalInteractionResponse({
      applicationId: env.DISCORD_APPLICATION_ID,
      interactionToken: interaction.token,
      payload: buildSuccessMessage({
        question,
        answer,
        image,
        model,
        match: riotMatch,
        penta
      })
    });
  } catch (error) {
    console.error("Erro ao processar /oraculo", error);
    await editOriginalInteractionResponse({
      applicationId: env.DISCORD_APPLICATION_ID,
      interactionToken: interaction.token,
      payload: buildErrorMessage(error)
    });
  }
}

async function handleInteraction(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    return json({ error: "Assinatura do Discord ausente." }, 401);
  }

  const rawBody = await request.text();
  const valid = await verifyKey(rawBody, signature, timestamp, env.DISCORD_PUBLIC_KEY);
  if (!valid) {
    return json({ error: "Assinatura do Discord inválida." }, 401);
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody) as DiscordInteraction;
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  if (interaction.type === InteractionType.PING) {
    return json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
    return json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "Esse tipo de interação ainda não é suportado.",
        flags: 64,
        allowed_mentions: { parse: [] }
      }
    });
  }

  if (!isAllowedGuild(interaction.guild_id, env.ALLOWED_GUILD_IDS)) {
    return json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "O Oráculo não está liberado neste servidor.",
        flags: 64,
        allowed_mentions: { parse: [] }
      }
    });
  }

  if (interaction.data?.name !== ORACLE_COMMAND) {
    return json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "Comando desconhecido.",
        flags: 64,
        allowed_mentions: { parse: [] }
      }
    });
  }

  const question = getQuestion(interaction);
  if (!question) {
    return json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "Escreva uma pergunta depois de `/oraculo pergunta:`.",
        flags: 64,
        allowed_mentions: { parse: [] }
      }
    });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `A pergunta é longa demais. Reduza para até ${MAX_QUESTION_LENGTH} caracteres.`,
        flags: 64,
        allowed_mentions: { parse: [] }
      }
    });
  }

  ctx.waitUntil(processOracle(interaction, truncate(question, MAX_QUESTION_LENGTH), env));

  return json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({
        ok: true,
        service: "oraculo-discord",
        environment: env.ENVIRONMENT || "unknown",
        model: env.GEMINI_MODEL || "gemini-2.5-flash",
        googleSearch: toBoolean(env.ENABLE_GOOGLE_SEARCH, true),
        riotIntegration: Boolean(env.RIOT_API_KEY)
      });
    }

    if (request.method === "POST" && (url.pathname === "/" || url.pathname === "/interactions")) {
      return handleInteraction(request, env, ctx);
    }

    return json({ error: "Not found" }, 404);
  }
} satisfies ExportedHandler<Env>;
