import type {
  DeadlockPlayerSummary,
  GeminiAnswer,
  MatchHistoryGame,
  MatchHistorySummary,
  RiotMatchSummary,
  RiotPentaResult
} from "./types";
import { detectBestMatchIntent, truncate } from "./utils";

const RIOT_API_SOURCE = {
  title: "Riot Games API",
  uri: "https://developer.riotgames.com/apis"
};

const DEADLOCK_API_SOURCE = {
  title: "Deadlock API",
  uri: "https://deadlock-api.com"
};

function answer(text: string, sources = [RIOT_API_SOURCE]): GeminiAnswer {
  return {
    text: truncate(text, 750),
    sources,
    searchQueries: []
  };
}

function kda(game: MatchHistoryGame | RiotMatchSummary): string {
  return `${game.kills}/${game.deaths}/${game.assists}`;
}

function kdaRatio(game: MatchHistoryGame | RiotMatchSummary): string {
  if (game.deaths === 0) {
    return "perfeito";
  }
  return `${((game.kills + game.assists) / game.deaths).toFixed(2)}:1`;
}

function csPerMinute(game: MatchHistoryGame): string {
  if (game.gameDurationSeconds <= 0) {
    return "0.0";
  }
  return (game.cs / (game.gameDurationSeconds / 60)).toFixed(1);
}

function resultLabel(win: boolean): string {
  return win ? "vitoria" : "derrota";
}

function championLine(summary: MatchHistorySummary): string {
  const top = summary.champions.slice(0, 3).map((champion) => {
    const wr = champion.games > 0 ? Math.round((champion.wins / champion.games) * 100) : 0;
    return `${champion.championName}: ${champion.games}j, ${wr}% WR`;
  });

  return top.join(" | ");
}

export function buildLatestMatchAnswer(match: RiotMatchSummary): GeminiAnswer {
  return answer(
    `**Ultima partida: ${match.championName}, ${resultLabel(match.win)}.**\n` +
      `- KDA: ${kda(match)} (${kdaRatio(match)})\n` +
      `- CS: ${match.cs} | Visao: ${match.visionScore}\n` +
      `- Leitura rapida: ${match.win ? "deu bom; replica o plano." : "da para revisar mortes/tempo de mapa."}`
  );
}

export function buildPentaAnswer(penta: RiotPentaResult): GeminiAnswer {
  if (!penta.found || !penta.match) {
    const queue = penta.queueLabel ? ` em ${penta.queueLabel}` : "";
    return answer(`**Nao achei pentakill${queue} nas ultimas ${penta.scanned} partidas.**\n- Pode existir um mais antigo fora dessa janela.\n- Quer mais alcance? aumente a janela, mas custa mais Riot API.`);
  }

  const match = penta.match;
  return answer(
    `**Ultimo penta: ${match.championName}, ${resultLabel(match.win)}.** 🔥\n` +
      `- Pentas: ${match.pentaKills}\n` +
      `- KDA: ${kda(match)} (${kdaRatio(match)})\n` +
      `- Partida analisada via Riot API.`
  );
}

export function buildHistoryAnswer(question: string, summary: MatchHistorySummary): GeminiAnswer {
  const best = summary.highlights.bestKda;
  const kills = summary.highlights.mostKills;
  const cs = summary.highlights.bestCsPerMinute;
  const bestWr = summary.highlights.bestWinrateChampion;

  if (detectBestMatchIntent(question) && best) {
    return answer(
      `**Sua melhor partida recente foi de ${best.championName}: ${kda(best)} (${kdaRatio(best)}), ${resultLabel(best.win)}.** 📊\n` +
        `${kills ? `- Mais kills: ${kills.championName}, ${kills.kills} kills.\n` : ""}` +
        `${cs ? `- Melhor farm: ${cs.championName}, ${csPerMinute(cs)} CS/min.\n` : ""}` +
        `- Janela: ${summary.totalGames} partidas${summary.queueLabel ? ` (${summary.queueLabel})` : ""}.`
    );
  }

  return answer(
    `**Seus melhores sinais recentes: ${championLine(summary)}.** 📊\n` +
      `${bestWr ? `- Melhor WR com 2+ jogos: ${bestWr.championName} (${Math.round((bestWr.wins / bestWr.games) * 100)}%).\n` : ""}` +
      `${best ? `- Melhor KDA: ${best.championName}, ${kda(best)} (${kdaRatio(best)}).\n` : ""}` +
      `- Janela: ${summary.totalGames} partidas${summary.queueLabel ? ` (${summary.queueLabel})` : ""}.`
  );
}

export function buildDeadlockAnswer(summary: DeadlockPlayerSummary): GeminiAnswer {
  const top = summary.heroStats.slice(0, 3).map((hero) => {
    const wr = hero.matches > 0 ? Math.round((hero.wins / hero.matches) * 100) : 0;
    return `${hero.heroName}: ${hero.matches}p, ${wr}% WR`;
  });

  return answer(
    `**Deadlock: seus herois mais fortes recentes parecem ser ${top.join(" | ")}.** 🎯\n` +
      `- Total lido: ${summary.totalMatches} partidas.\n` +
      `- Use isso como sinal de conforto, nao como tier list absoluta.`,
    [DEADLOCK_API_SOURCE]
  );
}
