import { describe, expect, it } from "vitest";
import {
  detectBuildOrCurrentInfoIntent,
  detectHistoryIntent,
  detectPersonalStatsIntent,
  detectQueue,
  extractRiotIds,
  formatDuration,
  isAllowedGuild,
  normalizeText,
  toInteger,
  truncate,
  uniqueSources
} from "../src/utils";
import { buildHistoryAnswer } from "../src/answers";
import type { MatchHistorySummary } from "../src/types";

describe("normalizeText", () => {
  it("normaliza acentos, caixa e pontuação", () => {
    expect(normalizeText("Cho'Gath — MELHOR build!")) .toBe("cho gath melhor build");
  });
});

describe("extractRiotIds", () => {
  it("extrai Riot ID simples como candidato", () => {
    expect(extractRiotIds("qual foi a última partida de Kaic#BR1?")).toContainEqual({
      gameName: "Kaic",
      tagLine: "BR1"
    });
  });

  it("suporta nomes com espaço, com o candidato mais específico primeiro", () => {
    const ids = extractRiotIds("quando foi o último penta de VAGABUNDO TA LÁ#NEYMA?");
    expect(ids[0]).toEqual({ gameName: "VAGABUNDO TA LÁ", tagLine: "NEYMA" });
    expect(ids).toContainEqual({ gameName: "LÁ", tagLine: "NEYMA" });
  });

  it("retorna vazio quando não há tag", () => {
    expect(extractRiotIds("qual a build de MF?")).toHaveLength(0);
  });
});

describe("detectQueue", () => {
  it("separa por fila quando mencionada", () => {
    expect(detectQueue("meu último penta na ranqueada")?.label).toBe("Ranqueada");
    expect(detectQueue("penta no ARAM")?.ids).toEqual([450]);
    expect(detectQueue("qual a build de Ahri")).toBeNull();
  });
});

describe("isAllowedGuild", () => {
  it("aceita tudo sem configuração", () => {
    expect(isAllowedGuild("1", "")).toBe(true);
  });

  it("restringe para os ids configurados", () => {
    expect(isAllowedGuild("2", "1, 2,3")).toBe(true);
    expect(isAllowedGuild("9", "1, 2,3")).toBe(false);
  });
});

describe("helpers", () => {
  it("formata duração", () => {
    expect(formatDuration(1902)).toBe("31m42s");
  });

  it("trunca com reticências", () => {
    expect(truncate("abcdef", 5)).toBe("abcd…");
  });

  it("remove fontes repetidas", () => {
    expect(
      uniqueSources([
        { title: "A", uri: "https://a.test" },
        { title: "A2", uri: "https://a.test" },
        { title: "B", uri: "https://b.test" }
      ])
    ).toHaveLength(2);
  });

  it("le inteiro de env com limites", () => {
    expect(toInteger("40", 20, 5, 80)).toBe(40);
    expect(toInteger("999", 20, 5, 80)).toBe(80);
    expect(toInteger("x", 20, 5, 80)).toBe(20);
  });
});

describe("intents", () => {
  it("detecta perguntas de stats pessoais", () => {
    expect(detectPersonalStatsIntent("quais sao meus melhores campeoes no lol ranked? Kaic#BR1")).toBe(true);
    expect(detectPersonalStatsIntent("qual meu melhor kda? Kaic#BR1")).toBe(true);
    expect(detectPersonalStatsIntent("como está meu cs/m no lol e como posso melhorar? UGA#0666")).toBe(true);
    expect(detectPersonalStatsIntent("qual meu farm medio? Kaic#BR1")).toBe(true);
    expect(detectPersonalStatsIntent("como está meu estilo de jogo em media? Kaic#BR1")).toBe(true);
  });

  it("mantem ultima partida fora do historico agregado", () => {
    expect(detectHistoryIntent("qual foi minha ultima partida? Kaic#BR1")).toBe(false);
    expect(detectPersonalStatsIntent("qual foi minha ultima partida? Kaic#BR1")).toBe(false);
  });

  it("detecta perguntas que precisam de contexto atual", () => {
    expect(detectBuildOrCurrentInfoIntent("build da Ahri mid")).toBe(true);
    expect(detectBuildOrCurrentInfoIntent("noticias do Deadlock")).toBe(true);
  });
});

describe("deterministic answers", () => {
  it("resume historico sem Gemini", () => {
    const summary: MatchHistorySummary = {
      riotId: "Kaic#BR1",
      totalGames: 3,
      champions: [
        {
          championName: "Ahri",
          games: 2,
          wins: 2,
          kills: 18,
          deaths: 6,
          assists: 20,
          cs: 430,
          visionScore: 35
        },
        {
          championName: "Syndra",
          games: 1,
          wins: 0,
          kills: 9,
          deaths: 2,
          assists: 4,
          cs: 210,
          visionScore: 12
        }
      ],
      games: [
        {
          championName: "Ahri",
          win: true,
          kills: 8,
          deaths: 3,
          assists: 12,
          cs: 220,
          visionScore: 20,
          gameDurationSeconds: 1800,
          gameMode: "CLASSIC",
          queueId: 420
        },
        {
          championName: "Syndra",
          win: false,
          kills: 9,
          deaths: 2,
          assists: 4,
          cs: 210,
          visionScore: 12,
          gameDurationSeconds: 1500,
          gameMode: "CLASSIC",
          queueId: 420
        }
      ],
      highlights: {
        bestKda: {
          championName: "Syndra",
          win: false,
          kills: 9,
          deaths: 2,
          assists: 4,
          cs: 210,
          visionScore: 12,
          gameDurationSeconds: 1500,
          gameMode: "CLASSIC",
          queueId: 420
        },
        bestWinrateChampion: {
          championName: "Ahri",
          games: 2,
          wins: 2,
          kills: 18,
          deaths: 6,
          assists: 20,
          cs: 430,
          visionScore: 35
        }
      }
    };

    const answer = buildHistoryAnswer("quais meus melhores campeoes?", summary);
    expect(answer.text).toContain("Ahri");
    expect(answer.text.length).toBeLessThanOrEqual(750);
    expect(answer.sources[0]?.title).toBe("Riot Games API");
  });

  it("responde perguntas de media com metricas agregadas", () => {
    const summary: MatchHistorySummary = {
      riotId: "UGA#0666",
      totalGames: 2,
      champions: [
        {
          championName: "Akshan",
          games: 1,
          wins: 1,
          kills: 8,
          deaths: 3,
          assists: 18,
          cs: 220,
          visionScore: 18
        },
        {
          championName: "Yone",
          games: 1,
          wins: 0,
          kills: 4,
          deaths: 7,
          assists: 5,
          cs: 160,
          visionScore: 10
        }
      ],
      games: [
        {
          championName: "Akshan",
          win: true,
          kills: 8,
          deaths: 3,
          assists: 18,
          cs: 220,
          visionScore: 18,
          gameDurationSeconds: 1800,
          gameMode: "CLASSIC",
          queueId: 440
        },
        {
          championName: "Yone",
          win: false,
          kills: 4,
          deaths: 7,
          assists: 5,
          cs: 160,
          visionScore: 10,
          gameDurationSeconds: 1600,
          gameMode: "CLASSIC",
          queueId: 440
        }
      ],
      highlights: {}
    };

    const answer = buildHistoryAnswer("como está meu cs/m no lol e como posso melhorar? UGA#0666", summary);

    expect(answer.text).toContain("Media recente");
    expect(answer.text).toContain("CS/min");
    expect(answer.text).toContain("Janela: 2 partidas");
    expect(answer.text).not.toContain("Ultima partida");
  });
});
