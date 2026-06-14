import { describe, expect, it } from "vitest";
import {
  extractRiotIds,
  formatDuration,
  isAllowedGuild,
  normalizeText,
  truncate,
  uniqueSources
} from "../src/utils";

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
});
