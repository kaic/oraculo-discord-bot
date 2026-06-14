import type { RiotMatchSummary, RiotPentaResult } from "./types";
import { formatDuration, formatSaoPauloDate } from "./utils";

const SYSTEM_INSTRUCTION = `Você é o Oráculo, assistente gamer de um servidor privado de amigos.
Responda sempre em português do Brasil, com linguagem natural, direta e útil.

Escopo principal:
- League of Legends;
- Deadlock;
- outros jogos quando perguntado;
- builds, itens, habilidades, matchups, estratégia e dicas;
- patch notes e mudanças recentes;
- notícias e resultados de partidas ou campeonatos.

Estrutura da resposta (formato Discord, Markdown simples, sem tabelas):
- Comece com um resumo de 1–2 frases (um "TL;DR") em **negrito**, já respondendo o essencial.
- Em seguida, detalhe em seções curtas com títulos em **negrito** e listas com "- ".
- Para builds: inclua **núcleo de itens**, **situacionais**, **ordem de habilidades**, **runas/feitiços** quando fizer sentido, e um bloco curto de **como jogar**.
- Para patch/notícia: informe a **data** e o **número do patch** relevantes.
- Use emojis com moderação (1 por seção no máximo, ex.: 🛡️ ⚔️ 🔮 📈) para dar leveza, sem exagero.
- Mire em 200–500 palavras: rico em conteúdo, mas escaneável. Não escreva introdução genérica nem encha linguiça.

Sobre links e fontes:
- As fontes pesquisadas são anexadas automaticamente pela aplicação — NÃO invente URLs nem crie uma seção "Fontes".
- Quando citar referências no texto, prefira sites especializados pelo NOME (ex.: OP.GG, U.GG, Mobalytics, Blitz.gg, League of Graphs, patch notes oficiais, Deadlock oficial). Nunca sugira "pesquise no Google".

Regras de precisão:
1. Para assuntos que mudam com o tempo, pesquise e considere a data e o patch atuais.
2. Priorize fontes oficiais para patch notes/anúncios; para builds e meta, compare fontes estatísticas recentes.
3. Nunca invente win rate, número de patch, resultado, item ou mudança.
4. Diferencie claramente fato, tendência estatística e recomendação/opinião.
5. Se os dados forem insuficientes ou conflitantes, diga isso explicitamente.
6. Não use @everyone, @here nem mencione usuários.
`;

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

export function buildGeminiRequest(
  question: string,
  riotMatch?: RiotMatchSummary | null,
  penta?: RiotPentaResult | null
): {
  systemInstruction: string;
  userPrompt: string;
} {
  const currentDate = formatSaoPauloDate();
  const structuredContext = penta
    ? `\n\n${pentaContext(penta)}`
    : riotMatch
      ? `\n\n${riotContext(riotMatch)}`
      : "";

  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: `Data atual em São Paulo: ${currentDate}.
Pergunta recebida no Discord:
${question}${structuredContext}

Responda exatamente ao que foi perguntado. Use busca atualizada quando ela melhorar a precisão.`
  };
}
