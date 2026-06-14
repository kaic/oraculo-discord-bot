import type { RiotMatchSummary } from "./types";
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

Regras obrigatórias:
1. Para assunto que muda com o tempo, pesquise e considere a data atual e o patch atual.
2. Priorize fontes oficiais para patch notes e anúncios; para builds e meta, compare fontes estatísticas recentes quando possível.
3. Não invente win rate, número de patch, resultado, item ou mudança.
4. Diferencie claramente fato, tendência estatística e recomendação/opinião.
5. Se os dados forem insuficientes ou conflitantes, diga isso.
6. Não escreva uma introdução genérica. Comece pela resposta.
7. Formate para Discord usando Markdown simples. Não use tabela Markdown.
8. Mantenha a resposta entre 250 e 700 palavras, salvo quando a pergunta pedir algo muito curto.
9. Para build, inclua núcleo, situacionais, ordem/prioridade e como jogar; adapte ao patch e contexto.
10. Para notícia ou patch, informe a data relevante.
11. Não inclua uma seção de links inventados. As fontes serão anexadas pela aplicação.
12. Não use @everyone, @here nem mencione usuários.
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

export function buildGeminiRequest(question: string, riotMatch?: RiotMatchSummary | null): {
  systemInstruction: string;
  userPrompt: string;
} {
  const currentDate = formatSaoPauloDate();
  const structuredContext = riotMatch ? `\n\n${riotContext(riotMatch)}` : "";

  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: `Data atual em São Paulo: ${currentDate}.
Pergunta recebida no Discord:
${question}${structuredContext}

Responda exatamente ao que foi perguntado. Use busca atualizada quando ela melhorar a precisão.`
  };
}
