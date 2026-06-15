import type {
  ChampionHistoryStat,
  MatchHistoryGame,
  MatchHistoryHighlights,
  MatchHistorySummary,
  RiotId,
  RiotMatchSummary,
  RiotPentaResult
} from "./types";

interface RiotAccount {
  puuid: string;
  gameName?: string;
  tagLine?: string;
}

interface RiotParticipant {
  puuid: string;
  championName: string;
  teamPosition?: string;
  individualPosition?: string;
  lane?: string;
  role?: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  visionScore: number;
  pentaKills: number;
}

function participantLane(participant: RiotParticipant): string {
  const raw = participant.teamPosition || participant.individualPosition || participant.lane || participant.role || "UNKNOWN";
  const normalized = raw.toUpperCase();
  const labels: Record<string, string> = {
    TOP: "Top",
    JUNGLE: "Jungle",
    MIDDLE: "Mid",
    MID: "Mid",
    BOTTOM: "Bot",
    ADC: "Bot",
    UTILITY: "Suporte",
    SUPPORT: "Suporte",
    NONE: "Sem rota",
    UNKNOWN: "Sem rota"
  };

  return labels[normalized] ?? raw;
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

// Varre os matchIds (já vêm do mais recente para o mais antigo) em lotes para
// não estourar o rate limit da Riot, e para no primeiro que casar o predicado —
// ou seja, devolve a ocorrência mais recente sem precisar baixar todas as partidas.
async function findFirstMatch(
  routing: string,
  matchIds: string[],
  apiKey: string,
  puuid: string,
  predicate: (participant: RiotParticipant, match: RiotMatch) => boolean
): Promise<{ match: RiotMatch; participant: RiotParticipant } | null> {
  const concurrency = 10;

  for (let i = 0; i < matchIds.length; i += concurrency) {
    const chunk = matchIds.slice(i, i + concurrency);
    const matches = await Promise.all(
      chunk.map((id) => fetchMatch(routing, id, apiKey).catch(() => null))
    );

    for (const match of matches) {
      if (!match) {
        continue;
      }
      const participant = match.info.participants.find((item) => item.puuid === puuid);
      if (participant && predicate(participant, match)) {
        return { match, participant };
      }
    }
  }

  return null;
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

function summarizeHistoryGame(match: RiotMatch, participant: RiotParticipant): MatchHistoryGame {
  return {
    championName: participant.championName,
    lane: participantLane(participant),
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

function kdaScore(game: MatchHistoryGame): number {
  return (game.kills + game.assists) / Math.max(1, game.deaths);
}

function csPerMinute(game: MatchHistoryGame): number {
  return game.gameDurationSeconds > 0 ? game.cs / (game.gameDurationSeconds / 60) : 0;
}

function buildHighlights(champions: ChampionHistoryStat[], games: MatchHistoryGame[]): MatchHistoryHighlights {
  const bestKda = [...games].sort((a, b) => kdaScore(b) - kdaScore(a))[0];
  const mostKills = [...games].sort((a, b) => b.kills - a.kills)[0];
  const bestCsPerMinute = [...games].sort((a, b) => csPerMinute(b) - csPerMinute(a))[0];
  const bestVision = [...games].sort((a, b) => b.visionScore - a.visionScore)[0];
  const bestWinrateChampion = champions
    .filter((champion) => champion.games >= 2)
    .sort((a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games)[0];

  return {
    ...(bestKda ? { bestKda } : {}),
    ...(mostKills ? { mostKills } : {}),
    ...(bestCsPerMinute ? { bestCsPerMinute } : {}),
    ...(bestVision ? { bestVision } : {}),
    ...(bestWinrateChampion ? { bestWinrateChampion } : {})
  };
}

export async function getLatestLolMatch(
  candidates: RiotId[],
  apiKey: string,
  routingRegion = "americas",
  queueIds?: number[]
): Promise<RiotMatchSummary> {
  const routing = routingRegion.trim().toLowerCase() || "americas";
  const { account, riotId } = await resolveAccount(candidates, apiKey, routing);

  // Sem filtro de fila, basta a última partida; com filtro, varremos o histórico
  // recente até achar a partida mais recente daquela fila.
  if (!queueIds || queueIds.length === 0) {
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

  const matchIds = await fetchMatchIds(routing, account.puuid, apiKey, 40);
  if (matchIds.length === 0) {
    throw new Error("Nenhuma partida recente foi encontrada para esse Riot ID.");
  }
  const found = await findFirstMatch(routing, matchIds, apiKey, account.puuid, (_, match) =>
    queueIds.includes(match.info.queueId)
  );
  if (!found) {
    throw new Error("Nenhuma partida recente nessa fila foi encontrada.");
  }
  return summarize(found.match, found.participant, riotId, account);
}

export async function getMatchHistorySummary(
  candidates: RiotId[],
  apiKey: string,
  routingRegion = "americas",
  count = 20,
  queueIds?: number[]
): Promise<MatchHistorySummary> {
  const routing = routingRegion.trim().toLowerCase() || "americas";
  const { account, riotId } = await resolveAccount(candidates, apiKey, routing);

  const matchIds = await fetchMatchIds(routing, account.puuid, apiKey, count);
  if (matchIds.length === 0) {
    throw new Error("Nenhuma partida recente foi encontrada para esse Riot ID.");
  }

  const champMap = new Map<string, ChampionHistoryStat>();
  const games: MatchHistoryGame[] = [];
  const concurrency = 10;

  for (let i = 0; i < matchIds.length; i += concurrency) {
    const chunk = matchIds.slice(i, i + concurrency);
    const matches = await Promise.all(chunk.map((id) => fetchMatch(routing, id, apiKey).catch(() => null)));

    for (const match of matches) {
      if (!match) continue;
      if (queueIds && queueIds.length > 0 && !queueIds.includes(match.info.queueId)) continue;

      const participant = match.info.participants.find((p) => p.puuid === account.puuid);
      if (!participant) continue;

      games.push(summarizeHistoryGame(match, participant));

      const name = participant.championName;
      const existing: ChampionHistoryStat = champMap.get(name) ?? {
        championName: name,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        visionScore: 0,
        lanes: {}
      };

      existing.games += 1;
      existing.wins += participant.win ? 1 : 0;
      existing.kills += participant.kills ?? 0;
      existing.deaths += participant.deaths ?? 0;
      existing.assists += participant.assists ?? 0;
      existing.cs += (participant.totalMinionsKilled ?? 0) + (participant.neutralMinionsKilled ?? 0);
      existing.visionScore += participant.visionScore ?? 0;
      const lane = participantLane(participant);
      existing.lanes[lane] = (existing.lanes[lane] ?? 0) + 1;

      champMap.set(name, existing);
    }
  }

  const champions = Array.from(champMap.values()).sort((a, b) => b.games - a.games);
  const riotIdStr = `${account.gameName ?? riotId.gameName}#${account.tagLine ?? riotId.tagLine}`;

  return {
    riotId: riotIdStr,
    totalGames: games.length,
    champions,
    games,
    highlights: buildHighlights(champions, games)
  };
}

export async function getLastPentakill(
  candidates: RiotId[],
  apiKey: string,
  routingRegion = "americas",
  scanCount = 40,
  queueIds?: number[]
): Promise<RiotPentaResult> {
  const routing = routingRegion.trim().toLowerCase() || "americas";
  const { account, riotId } = await resolveAccount(candidates, apiKey, routing);

  const matchIds = await fetchMatchIds(routing, account.puuid, apiKey, scanCount);
  if (matchIds.length === 0) {
    return { found: false, scanned: 0 };
  }

  const found = await findFirstMatch(
    routing,
    matchIds,
    apiKey,
    account.puuid,
    (participant, match) =>
      (participant.pentaKills ?? 0) > 0 &&
      (!queueIds || queueIds.length === 0 || queueIds.includes(match.info.queueId))
  );

  if (found) {
    return {
      found: true,
      scanned: matchIds.length,
      match: summarize(found.match, found.participant, riotId, account)
    };
  }

  return { found: false, scanned: matchIds.length };
}
