import type { DeadlockPlayerSummary, MatchHistorySummary, RiotMatchSummary, RiotPentaResult } from "./types";
import { detectBuildOrCurrentInfoIntent, formatDuration, formatSaoPauloDate, normalizeText } from "./utils";

export function constitutionContext(constitution?: string): string {
  const text = constitution?.trim();
  if (text) {
    return `\nConstituicao do servidor, com prioridade maxima sobre meta, build, estatistica e opiniao:
${text.slice(0, 2000)}
Se a pergunta conflitar com a Constituicao, responda seguindo a Constituicao e explique curto.`;
  }

  return "\nCultura do grupo: responda como bot gamer de servidor privado, sem citar regras internas nao configuradas.";
}

function systemInstruction(question: string, constitution?: string): string {
  const normalizedQuestion = normalizeText(question);
  const wantsBuild = detectBuildOrCurrentInfoIntent(question) && /\b(build|item|itens|runa|runas)\b/.test(normalizedQuestion);
  const asksMatchup = /\b(contra|vs|versus|matchup|counter|lane|rota contra)\b/.test(normalizedQuestion);
  const buildInstruction = wantsBuild
    ? `
Para pergunta de build, responda a build diretamente:
- Cite item inicial, botas e 3-5 itens core em ordem com nomes especificos.
- Cite runas principais quando fizer sentido.
- Cite 1-2 itens situacionais curtos.
- Inclua OP.GG/U.GG/LoLalytics como locais para conferir, mas nao invente URL se nao veio da busca.
- Nao foque em matchup/counter a menos que a pergunta peca isso explicitamente${asksMatchup ? " (esta pergunta pediu matchup)." : "."}`
    : "";

  return `Voce e o Oraculo, bot gamer de um servidor privado.
Responda em PT-BR, direto, util e com humor leve.
Limite: ate 750 caracteres.
Formato: comece com **resumo direto**, depois 3-5 bullets curtos.
Use no maximo 2-3 emojis no total. Sem tabelas. Sem enrolacao.
Nao crie secao "Fontes" nem invente URLs; a aplicacao anexa fontes reais.
Prioridade de fontes: oficial > API/estatistica > sites especializados > Reddit como opiniao/comunidade.
Para LoL, prefira Riot, Data Dragon, patch notes oficiais, OP.GG, U.GG, League of Graphs, Mobalytics, Lolalytics e Blitz.
Para Deadlock, prefira fontes oficiais/Steam, deadlock-api e comunidades confiaveis.
Nunca invente win rate, patch, item, resultado ou dado. Se faltar dado, diga curto.${buildInstruction}${constitutionContext(constitution)}`;
}

function riotContext(match: RiotMatchSummary): string {
  return `DADO ESTRUTURADO DA API OFICIAL DA RIOT PARA A ÚLTIMA PARTIDA:
- Riot ID: ${match.riotId}
- Campeão: ${match.championName}
- Resultado: ${match.win ? "vitória" : "derrota"}
- K/D/A: ${match.kills}/${match.deaths}/${match.assists}
- CS: ${match.cs}
- Vision score: ${match.visionScore}
- Duração: ${formatDuration(match.gameDurationSeconds)}
- Modo: ${match.gameMode}
- Queue ID: ${match.queueId}
${match.endedAtIso ? `- Fim da partida (UTC): ${match.endedAtIso}` : ""}
Use esses números como fonte primária e não os altere.`;
}

function pentaContext(penta: RiotPentaResult): string {
  const queueNote = penta.queueLabel ? ` na fila ${penta.queueLabel}` : "";
  if (penta.found && penta.match) {
    const m = penta.match;
    return `DADO ESTRUTURADO DA API OFICIAL DA RIOT — ÚLTIMO PENTAKILL ENCONTRADO${queueNote} (varredura das últimas ${penta.scanned} partidas):
- Riot ID: ${m.riotId}
- Campeão: ${m.championName}
- Pentakills nessa partida: ${m.pentaKills}
- K/D/A: ${m.kills}/${m.deaths}/${m.assists}
- Resultado: ${m.win ? "vitória" : "derrota"}
- Modo: ${m.gameMode}
${m.endedAtIso ? `- Fim da partida (UTC): ${m.endedAtIso}` : ""}
Use esses números como fonte primária e não os altere. Informe claramente o campeão e a data do pentakill.`;
  }

  return `DADO ESTRUTURADO DA API OFICIAL DA RIOT:
Nenhum pentakill foi encontrado${queueNote} nas últimas ${penta.scanned} partidas analisadas dessa conta.
Deixe claro que a verificação cobriu apenas as últimas ${penta.scanned} partidas${queueNote} e que pode haver pentakills mais antigos fora desse intervalo. Não invente data nem campeão.`;
}

function matchHistoryContext(summary: MatchHistorySummary): string {
  const queueNote = summary.queueLabel ? ` na fila ${summary.queueLabel}` : "";
  const lines = summary.champions.slice(0, 10).map((c, i) => {
    const wr = c.games > 0 ? ((c.wins / c.games) * 100).toFixed(1) : "0.0";
    const avgK = (c.kills / c.games).toFixed(1);
    const avgD = (c.deaths / c.games).toFixed(1);
    const avgA = (c.assists / c.games).toFixed(1);
    const avgCs = Math.round(c.cs / c.games);
    return `  ${i + 1}. ${c.championName}: ${c.games} partida${c.games !== 1 ? "s" : ""} | ${c.wins}V/${c.games - c.wins}D (${wr}% WR) | KDA médio: ${avgK}/${avgD}/${avgA} | CS médio: ${avgCs}`;
  });

  return `DADO ESTRUTURADO DA API OFICIAL DA RIOT — HISTÓRICO${queueNote} DAS ÚLTIMAS ${summary.totalGames} PARTIDAS:
- Riot ID: ${summary.riotId}
- Total de partidas analisadas: ${summary.totalGames}
- Campeões do mais jogado ao menos jogado:
${lines.join("\n")}
Use esses dados como fonte primária. Não invente estatísticas.`;
}

function deadlockHistoryContext(summary: DeadlockPlayerSummary): string {
  const lines = summary.heroStats.slice(0, 10).map((h, i) => {
    const wr = h.matches > 0 ? ((h.wins / h.matches) * 100).toFixed(1) : "0.0";
    const avgK = (h.kills / h.matches).toFixed(1);
    const avgD = (h.deaths / h.matches).toFixed(1);
    const avgA = (h.assists / h.matches).toFixed(1);
    return `  ${i + 1}. ${h.heroName}: ${h.matches} partida${h.matches !== 1 ? "s" : ""} | ${h.wins}V/${h.matches - h.wins}D (${wr}% WR) | KDA médio: ${avgK}/${avgD}/${avgA}`;
  });

  return `DADO ESTRUTURADO DE DEADLOCK — HISTÓRICO DO JOGADOR (account ID: ${summary.accountId}):
- Total de partidas registradas: ${summary.totalMatches}
- Heróis do mais jogado ao menos jogado:
${lines.join("\n")}
Use esses dados como fonte primária. Não invente estatísticas.`;
}

export function buildGeminiRequest(
  question: string,
  riotMatch?: RiotMatchSummary | null,
  penta?: RiotPentaResult | null,
  matchHistory?: MatchHistorySummary | null,
  deadlockSummary?: DeadlockPlayerSummary | null,
  constitution?: string
): {
  systemInstruction: string;
  userPrompt: string;
} {
  const currentDate = formatSaoPauloDate();

  let structuredContext = "";
  if (penta) {
    structuredContext = `\n\n${pentaContext(penta)}`;
  } else if (matchHistory) {
    structuredContext = `\n\n${matchHistoryContext(matchHistory)}`;
  } else if (riotMatch) {
    structuredContext = `\n\n${riotContext(riotMatch)}`;
  } else if (deadlockSummary) {
    structuredContext = `\n\n${deadlockHistoryContext(deadlockSummary)}`;
  }

  return {
    systemInstruction: systemInstruction(question, constitution),
    userPrompt: `Data atual em São Paulo: ${currentDate}.
Pergunta recebida no Discord:
${question}${structuredContext}

Responda exatamente ao que foi perguntado. Use busca atualizada apenas quando melhorar precisão.`
  };
}
