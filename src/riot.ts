import type { RiotId, RiotMatchSummary } from "./types";

interface RiotAccount {
  puuid: string;
  gameName?: string;
  tagLine?: string;
}

interface RiotParticipant {
  puuid: string;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  visionScore: number;
}

interface RiotMatch {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameEndTimestamp?: number;
    gameMode: string;
    queueId: number;
    participants: RiotParticipant[];
  };
}

async function riotFetch<T>(url: string, apiKey: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "X-Riot-Token": apiKey,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("A chave da Riot está ausente, inválida ou expirada.");
    }
    if (response.status === 404) {
      throw new Error("Riot ID ou partida não encontrada.");
    }
    if (response.status === 429) {
      throw new Error("Limite temporário da API da Riot atingido.");
    }
    throw new Error(`API da Riot respondeu ${response.status}.`);
  }

  return response.json<T>();
}

export async function getLatestLolMatch(
  riotId: RiotId,
  apiKey: string,
  routingRegion = "americas"
): Promise<RiotMatchSummary> {
  const routing = routingRegion.trim().toLowerCase() || "americas";
  const accountUrl = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
    riotId.gameName
  )}/${encodeURIComponent(riotId.tagLine)}`;
  const account = await riotFetch<RiotAccount>(accountUrl, apiKey);

  const idsUrl = `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
    account.puuid
  )}/ids?start=0&count=1`;
  const matchIds = await riotFetch<string[]>(idsUrl, apiKey);
  const matchId = matchIds[0];
  if (!matchId) {
    throw new Error("Nenhuma partida recente foi encontrada para esse Riot ID.");
  }

  const matchUrl = `https://${routing}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  const match = await riotFetch<RiotMatch>(matchUrl, apiKey);
  const participant = match.info.participants.find((item) => item.puuid === account.puuid);
  if (!participant) {
    throw new Error("O jogador não apareceu nos dados da partida encontrada.");
  }

  return {
    riotId: `${account.gameName ?? riotId.gameName}#${account.tagLine ?? riotId.tagLine}`,
    championName: participant.championName,
    win: participant.win,
    kills: participant.kills ?? 0,
    deaths: participant.deaths ?? 0,
    assists: participant.assists ?? 0,
    cs: (participant.totalMinionsKilled ?? 0) + (participant.neutralMinionsKilled ?? 0),
    visionScore: participant.visionScore ?? 0,
    gameDurationSeconds: match.info.gameDuration ?? 0,
    gameMode: match.info.gameMode ?? "UNKNOWN",
    queueId: match.info.queueId ?? 0,
    ...(match.info.gameEndTimestamp
      ? { endedAtIso: new Date(match.info.gameEndTimestamp).toISOString() }
      : {})
  };
}
