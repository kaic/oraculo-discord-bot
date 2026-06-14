import type { GeminiAnswer, SourceLink } from "./types";
import { uniqueSources } from "./utils";

interface GeminiPart {
  text?: string;
}

interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
  groundingMetadata?: {
    webSearchQueries?: string[];
    groundingChunks?: GroundingChunk[];
  };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export async function askGemini(params: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  prompt: string;
  enableGoogleSearch: boolean;
  timeoutMs?: number;
}): Promise<GeminiAnswer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Gemini timeout"), params.timeoutMs ?? 24000);

  try {
    const body: Record<string, unknown> = {
      systemInstruction: {
        parts: [{ text: params.systemInstruction }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: params.prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        // Folga alta: o gemini-2.5-flash gasta parte do orçamento com "thinking",
        // então um teto baixo cortava a resposta no meio.
        maxOutputTokens: 6144
      },
      store: false
    };

    if (params.enableGoogleSearch) {
      body.tools = [{ google_search: {} }];
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": params.apiKey
        },
        body: JSON.stringify(body),
        signal: controller.signal
      }
    );

    const payload = await response.json<GeminiResponse>();
    if (!response.ok || payload.error) {
      const message = payload.error?.message ?? `Gemini respondeu ${response.status}`;
      throw new Error(message);
    }

    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      const blockReason = payload.promptFeedback?.blockReason;
      throw new Error(blockReason ? `Resposta bloqueada: ${blockReason}` : "Gemini retornou resposta vazia.");
    }

    const sources: SourceLink[] =
      candidate?.groundingMetadata?.groundingChunks
        ?.map((chunk) => ({
          title: chunk.web?.title?.trim() || "Fonte",
          uri: chunk.web?.uri?.trim() || ""
        }))
        .filter((source) => source.uri.startsWith("http")) ?? [];

    return {
      text,
      sources: uniqueSources(sources, 5),
      searchQueries: candidate?.groundingMetadata?.webSearchQueries ?? []
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("A IA demorou mais do que o limite do Worker. Tente uma pergunta mais específica.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
