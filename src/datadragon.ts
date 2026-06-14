import type { ChampionImage } from "./types";
import { normalizeText } from "./utils";

interface DataDragonChampion {
  id: string;
  key: string;
  name: string;
  title: string;
  image: {
    full: string;
  };
}

interface DataDragonResponse {
  data: Record<string, DataDragonChampion>;
}

const COMMON_ALIASES: Record<string, string> = {
  mf: "MissFortune",
  missfortune: "MissFortune",
  cait: "Caitlyn",
  malph: "Malphite",
  naut: "Nautilus",
  shyv: "Shyvana",
  ww: "Warwick",
  noc: "Nocturne",
  kaisa: "KaiSa",
  khazix: "Khazix",
  kogmaw: "KogMaw",
  chogath: "Chogath",
  reksai: "RekSai",
  belveth: "Belveth",
  ksante: "KSante",
  lb: "Leblanc"
};

async function cachedJson<T>(request: Request, ttlSeconds: number): Promise<T> {
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const cached = await cache.match(request);
  if (cached) {
    return cached.json<T>();
  }

  const response = await fetch(request);
  if (!response.ok) {
    throw new Error(`Data Dragon respondeu ${response.status}`);
  }

  const cacheable = new Response(response.body, response);
  cacheable.headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);
  await cache.put(request, cacheable.clone());
  return cacheable.json<T>();
}

export async function findChampionImage(question: string): Promise<ChampionImage | null> {
  try {
    const versionsRequest = new Request("https://ddragon.leagueoflegends.com/api/versions.json");
    const versions = await cachedJson<string[]>(versionsRequest, 86400);
    const version = versions[0];
    if (!version) {
      return null;
    }

    const championsRequest = new Request(
      `https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(version)}/data/pt_BR/champion.json`
    );
    const payload = await cachedJson<DataDragonResponse>(championsRequest, 86400);
    const champions = Object.values(payload.data);
    const normalizedQuestion = ` ${normalizeText(question)} `;

    const aliasEntries = Object.entries(COMMON_ALIASES).sort((a, b) => b[0].length - a[0].length);
    for (const [alias, championId] of aliasEntries) {
      const aliasPattern = ` ${normalizeText(alias)} `;
      if (!normalizedQuestion.includes(aliasPattern)) {
        continue;
      }

      const champion = payload.data[championId];
      if (champion) {
        return {
          championName: champion.name,
          id: champion.id,
          url: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.image.full}`
        };
      }
    }

    const sorted = champions.sort((a, b) => b.name.length - a.name.length);
    for (const champion of sorted) {
      const candidates = [champion.name, champion.id].map((value) => ` ${normalizeText(value)} `);
      if (candidates.some((candidate) => normalizedQuestion.includes(candidate))) {
        return {
          championName: champion.name,
          id: champion.id,
          url: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.image.full}`
        };
      }
    }

    return null;
  } catch (error) {
    console.warn("Não foi possível resolver imagem de campeão", error);
    return null;
  }
}
