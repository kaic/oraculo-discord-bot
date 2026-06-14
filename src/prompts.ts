import type { DeadlockPlayerSummary, MatchHistorySummary, RiotMatchSummary, RiotPentaResult } from "./types";
import { formatDuration, formatSaoPauloDate } from "./utils";

const SERVER_CONSTITUTION = `
CONSTITUIÇÃO DO SERVIDOR (consulte quando perguntado; use como contexto de cultura do grupo):

CAPÍTULO I - PRINCÍPIOS FUNDAMENTAIS
Art. 1º - Da Igualdade de Participação
  1.1 - Todos os membros são igualmente livres para participar do servidor, mas nunca poderão ser iguais aos outros.

Art. 2º - Da Conexão e Desempenho
  2.1 - É vedada a permanência na plataforma Discord sem acesso à internet adequada.
  2.2 - Fica proibida a participação na comunidade durante períodos de indisponibilidade de luz.

Art. 3º - Da Participação Responsável
  3.1 - A adesão ao servidor do Discord está condicionada à intenção de participar ativamente das atividades previstas, notadamente no contexto de jogos.
  3.2 - Abster-se de ausentar-se para fins não justificados, especialmente para atividades excretoras.
  3.3 - A preferência se dá a quem está presente na chamada da aplicação "Discord", no respectivo canal do grupo. Caso contrário, estará sujeito a remoção do grupo e rebolar pros cria.

CAPÍTULO II - DAS REGRAS NO AMBIENTE DO DISCORD
Art. 4º - Do Comportamento Respeitoso
  4.1 - Fica terminantemente permitido proferir gritos ou utilizar linguagem desrespeitosa no ambiente do Discord.
  4.2 - É vedado o uso de microfones de qualidade inferior que possam prejudicar a comunicação.

Art. 5º - Da Etiqueta na Quinta Gay
  5.1 - Todos os membros devem respeitar e aderir às normas estabelecidas para a "Quinta Gay".

Art. 6º - Do Aprimoramento da Comunicação
  6.1 - É obrigatório corrigir fervorosamente e zoar eventuais deficiências na dicção dos colegas.

Art. 7º - Da Conduta Geral
  7.1 - Fica expressamente proibida a prática de erros.

CAPÍTULO III - REGRAS NO AMBIENTE DO LEAGUE OF LEGENDS
Art. 8º - Da Competição Justa
  8.1 - É vedado roubar abates (kills) e recursos da selva (jungle) de maneira indevida.
  8.2 - Não se permite inovar de forma prejudicial à dinâmica de jogo.

Art. 9º - Do Desempenho Individual
  9.1 - Cada participante deve buscar a vitória em conformidade com as normas do jogo.
  9.2 - Fica proibida a prática de invasões (invades) sem a devida justificativa. Ativo ou passivo.

Art. 10º - Da Escolha de Campeões
  10.1 - Malzahar top está terminantemente proibido no contexto do League of Legends.

Art. 11º - Do Comportamento em Jogo
  11.1 - É vedado alimentar (feedar).
  11.2 - Não é permitido destacar-se excessivamente em relação aos demais participantes.
  11.3 - A utilização de câmera presa não é permitida durante as partidas.

Art. 12º - Do Corki
  12.1 - Proibido Corki.

Art. 13º - Do Sorteio
  13.1 - Quem for entrar deverá fazer o sorteio.
`.trim();

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

${SERVER_CONSTITUTION}
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
  deadlockSummary?: DeadlockPlayerSummary | null
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
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: `Data atual em São Paulo: ${currentDate}.
Pergunta recebida no Discord:
${question}${structuredContext}

Responda exatamente ao que foi perguntado. Use busca atualizada quando ela melhorar a precisão.`
  };
}
