export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  GEMINI_API_KEY: string;
  RIOT_API_KEY?: string;
  GEMINI_MODEL?: string;
  ENABLE_GOOGLE_SEARCH?: string;
  ALLOWED_GUILD_IDS?: string;
  RIOT_ROUTING_REGION?: string;
  ENVIRONMENT?: string;
}

export interface DiscordInteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
}

export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  locale?: string;
  data?: {
    id: string;
    name: string;
    type: number;
    options?: DiscordInteractionOption[];
  };
  member?: {
    user?: {
      id: string;
      username: string;
      global_name?: string | null;
    };
  };
  user?: {
    id: string;
    username: string;
    global_name?: string | null;
  };
}

export interface SourceLink {
  title: string;
  uri: string;
}

export interface GeminiAnswer {
  text: string;
  sources: SourceLink[];
  searchQueries: string[];
}

export interface RiotId {
  gameName: string;
  tagLine: string;
}

export interface RiotMatchSummary {
  riotId: string;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  visionScore: number;
  pentaKills: number;
  gameDurationSeconds: number;
  gameMode: string;
  queueId: number;
  endedAtIso?: string;
}

export interface RiotPentaResult {
  found: boolean;
  scanned: number;
  match?: RiotMatchSummary;
  queueLabel?: string;
}

export interface ChampionHistoryStat {
  championName: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  visionScore: number;
}

export interface MatchHistorySummary {
  riotId: string;
  totalGames: number;
  champions: ChampionHistoryStat[];
  queueLabel?: string;
}

export interface DeadlockHeroStat {
  heroId: number;
  heroName: string;
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
}

export interface DeadlockPlayerSummary {
  accountId: string;
  heroStats: DeadlockHeroStat[];
  totalMatches: number;
}

export interface ChampionImage {
  championName: string;
  url: string;
  id: string;
}
