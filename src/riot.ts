import type { RiotId, RiotMatchSummary, RiotPentaResult } from "./types";

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
  pentaKills: number;
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

class RiotApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RiotApiError";
    this.status = status;
  }
}

function messageForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return "A chave da Riot está ausente, inválida ou expirada.";
  }
  if (status === 404) {
    return "Riot ID ou partida não encontrada.";
  }
  if (status === 429) {
    return "Limite temporário da API da Riot atingido.";
  }
  return `API da Riot respondeu ${status}.`;
}

async function riotFetch<T>(url: string, apiKey: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "X-Riot-Token": apiKey,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new RiotApiError(response.status, messageForStatus(response.status));
  }

  return response.json<T>();
}

// Em texto livre não sabemos onde o nome do jogador começa, então recebemos
// candidatos (do mais específico ao mais curto) e usamos o primeiro que a Riot
// reconhecer. Erros 404 apenas pulam para o próximo candidato.
async function resolveAccount(
  candidates: RiotId[],
  apiKey: string,
  routing: string
): Promise<{ account: RiotAccount; riotId: RiotId }> {
  let lastError: unknown;

  for (const riotId of candidates.slice(0, 4)) {
    const url = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      riotId.gameName
    )}/${encodeURIComponent(riotId.tagLine)}`;

    try {
      const account = await riotFetch<RiotAccount>(url, apiKey);
      return { account, riotId };
    } catch (error) {
      if (error instanceof RiotApiError && error.status === 404) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new RiotApiError(404, "Nenhuma conta encontrada para esse Riot ID.");
}

async function fetchMatchIds(
  routing: string,
  puuid: string,
  apiKey: string,
  count: number
): Promise<string[]> {
  return riotFetch<string[]>(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
      puuid
    )}/ids?start=0&count=${count}`,
    apiKey
  );
}

async function fetchMatch(routing: string, matchId: string, apiKey: string): Promise<RiotMatch> {
  return riotFetch<RiotMatch>(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
    apiKey
  );
}

function summarize(
  match: RiotMatch,
  participant: RiotParticipant,
  riotId: RiotId,
  account: RiotAccount
): RiotMatchSummary {
  return {
    riotId: `${account.gameName ?? riotId.gameName}#${account.tagLine ?? riotId.tagLine}`,
    championName: participant.championName,
    win: participant.win,
    kills: participant.kills ?? 0,
    deaths: participant.deaths ?? 0,
    assists: participant.assists ?? 0,
    cs: (participant.totalMinionsKilled ?? 0) + (participant.neutralMinionsKilled ?? 0),
    visionScore: participant.visionScore ?? 0,
    pentaKills: participant.pentaKills ?? 0,
    gameDurationSeconds: match.info.gameDuration ?? 0,
    gameMode: match.info.gameMode ?? "UNKNOWN",
    queueId: match.info.queueId ?? 0,
    ...(match.info.gameEndTimestamp
      ? { endedAtIso: new Date(match.info.gameEndTimestamp).toISOString() }
      : {})
  };
}

export async function getLatestLolMatch(
  candidates: RiotId[],
  apiKey: string,
  routingRegion = "americas"
): Promise<RiotMatchSummary> {
  const routing = routingRegion.trim().toLowerCase() || "americas";
  const { account, riotId } = await resolveAccount(candidates, apiKey, routing);

  const matchIds = await fetchMatchIds(routing, account.puuid, apiKey, 1);
  const matchId = matchIds[0];
  if (!matchId) {
    throw new Error("Nenhuma partida recente foi encontrada para esse Riot ID.");
  }

  const match = await fetchMatch(routing, matchId, apiKey);
  const participant = match.info.participants.find((item) => item.puuid === account.puuid);
  if (!participant) {
    throw new Error("O jogador não apareceu nos dados da partida encontrada.");
  }

  return summarize(match, participant, riotId, account);
}

export async function getLastPentakill(
  candidates: RiotId[],
  apiKey: string,
  routingRegion = "americas",
  scanCount = 15
): Promise<RiotPentaResult> {
  const routing = routingRegion.trim().toLowerCase() || "americas";
  const { account, riotId } = await resolveAccount(candidates, apiKey, routing);

  const matchIds = await fetchMatchIds(routing, account.puuid, apiKey, scanCount);
  if (matchIds.length === 0) {
    return { found: false, scanned: 0 };
  }

  // A match-v5 devolve os ids do mais recente para o mais antigo.
  const matches = await Promise.all(
    matchIds.map((id) => fetchMatch(routing, id, apiKey).catch(() => null))
  );

  for (const match of matches) {
    if (!match) {
      continue;
    }
    const participant = match.info.participants.find((item) => item.puuid === account.puuid);
    if (participant && (participant.pentaKills ?? 0) > 0) {
      return {
        found: true,
        scanned: matchIds.length,
        match: summarize(match, participant, riotId, account)
      };
    }
  }

  return { found: false, scanned: matchIds.length };
}
