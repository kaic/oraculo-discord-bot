import type { DeadlockPlayerSummary } from "./types";
import { normalizeText } from "./utils";

const FALLBACK_IMAGES = {
  lol: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ashe_0.jpg",
  deadlock: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1422450/header.jpg",
  pc: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/753/header.jpg"
};

export function inferFallbackImageUrl(question: string, deadlockSummary?: DeadlockPlayerSummary | null): string | null {
  const n = normalizeText(question);

  if (deadlockSummary || /\bdeadlock\b/.test(n)) {
    return FALLBACK_IMAGES.deadlock;
  }

  if (/\b(lol|league|league of legends|riot|campeao|champion|build|ranked|ranqueada)\b/.test(n)) {
    return FALLBACK_IMAGES.lol;
  }

  if (/\b(pc|hardware|gpu|cpu|placa de video|steam|gaming)\b/.test(n)) {
    return FALLBACK_IMAGES.pc;
  }

  return null;
}
