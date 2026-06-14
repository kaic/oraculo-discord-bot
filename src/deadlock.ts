import type { DeadlockHeroStat, DeadlockPlayerSummary } from "./types";

const API_BASE = "https://api.deadlock-api.com";

// Mapa estático de fallback — atualizar quando novos heróis forem adicionados.
const STATIC_HERO_NAMES: Record<number, string> = {
  1: "Infernus",
  2: "Seven",
  3: "Vindicta",
  4: "Lady Geist",
  6: "Abrams",
  7: "Wraith",
  8: "McGinnis",
  9: "Paradox",
  10: "Dynamo",
  11: "Kelvin",
  12: "Haze",
  13: "Bebop",
  14: "Grey Talon",
  15: "Mo & Krill",
  16: "Shiv",
  17: "Ivy",
  18: "Warden",
  19: "Viscous",
  20: "Yamato",
  25: "Lash",
  31: "Calico",
  35: "Holliday",
  48: "Mirage",
  50: "Pocket",
  52: "Sinclair"
};

interface ApiHero {
  id: number;
  name?: string;
  class_name?: string;
}

interface ApiHeroStat {
  hero_id: number;
  matches?: number;
  wins?: number;
  losses?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
}

async function resolveHeroNames(): Promise<Record<number, string>> {
  try {
    const res = await fetch(`${API_BASE}/v1/heroes`, { headers: { Accept: "application/json" } });
    if (!res.ok) return STATIC_HERO_NAMES;
    const heroes = await res.json<ApiHero[]>();
    if (!Array.isArray(heroes)) return STATIC_HERO_NAMES;

    const map: Record<number, string> = { ...STATIC_HERO_NAMES };
    for (const h of heroes) {
      if (h.id && h.name) map[h.id] = h.name;
    }
    return map;
  } catch {
    return STATIC_HERO_NAMES;
  }
}

// Converte Steam ID64 em Account ID de 32 bits usado pela API da Valve/Deadlock.
function toAccountId(steamId64: string): number {
  return Number(BigInt(steamId64) - 76561197960265728n);
}

export async function getDeadlockPlayerSummary(
  steamId64: string
): Promise<DeadlockPlayerSummary | null> {
  const accountId = toAccountId(steamId64);

  const [heroNames, statsRes] = await Promise.all([
    resolveHeroNames(),
    fetch(`${API_BASE}/v1/players/${accountId}/hero-stats`, {
      headers: { Accept: "application/json" }
    }).catch(() => null)
  ]);

  if (!statsRes?.ok) return null;

  const raw = await statsRes.json<ApiHeroStat[]>().catch(() => null);
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const heroStats: DeadlockHeroStat[] = raw
    .map((s) => {
      const matches = s.matches ?? (s.wins ?? 0) + (s.losses ?? 0);
      return {
        heroId: s.hero_id,
        heroName: heroNames[s.hero_id] ?? `Herói #${s.hero_id}`,
        matches,
        wins: s.wins ?? 0,
        kills: s.kills ?? 0,
        deaths: s.deaths ?? 0,
        assists: s.assists ?? 0
      };
    })
    .filter((h) => h.matches > 0)
    .sort((a, b) => b.matches - a.matches);

  if (heroStats.length === 0) return null;

  const totalMatches = heroStats.reduce((sum, h) => sum + h.matches, 0);
  return { accountId: String(accountId), heroStats, totalMatches };
}
