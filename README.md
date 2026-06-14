# 🔮 Oráculo — bot gamer com IA para Discord

MVP funcional de um bot privado para Discord, hospedado gratuitamente em **Cloudflare Workers**.

O usuário faz uma única pergunta em linguagem natural:

```text
/oraculo pergunta: qual a melhor build de Infernus híbrido no patch atual?
```

O Oráculo:

1. recebe o slash command pelo endpoint HTTP do Discord;
2. valida a assinatura criptográfica da interaction;
3. responde imediatamente com estado de carregamento;
4. consulta a API da Riot quando encontra um Riot ID como `Kaic#BR1`;
5. consulta o Gemini com Google Search para informações atuais;
6. encontra uma imagem de campeão do LoL quando aplicável;
7. edita a mensagem com texto, imagem e fontes clicáveis.

> O Discord representa argumentos de slash commands com um rótulo. Portanto, visualmente o comando aparece como `/oraculo pergunta: ...`. Depois de selecionar `/oraculo`, basta escrever a pergunta normalmente no campo exibido.

---

## Funcionalidades do MVP

- Perguntas livres sobre League of Legends, Deadlock e outros jogos.
- Builds, matchups, itens, habilidades e dicas.
- Patch notes e notícias atuais.
- Resultados de esports pesquisáveis na web.
- Última partida de uma conta do LoL por Riot ID, quando `RIOT_API_KEY` está configurada.
- Fontes clicáveis retornadas pelo Gemini Grounding.
- Ícone do campeão via Riot Data Dragon quando o campeão é reconhecido.
- Restrição do bot a um único servidor do Discord.
- Deploy automático por GitHub Actions.
- Health check em `/` e `/health`.
- Nenhum servidor ou processo precisa ficar permanentemente ligado.

Exemplos:

```text
/oraculo pergunta: qual a melhor build de MF ADC no patch atual?
/oraculo pergunta: o que mudou no Infernus no patch mais recente?
/oraculo pergunta: qual foi a última partida de Kaic#BR1?
/oraculo pergunta: quais foram as principais notícias de League of Legends nesta semana?
/oraculo pergunta: como jogar de Malphite contra Darius?
```

---

## Arquitetura

```text
Discord /oraculo
        │
        ▼
Cloudflare Worker
        ├── valida assinatura Ed25519
        ├── responde DEFERRED (loading)
        ├── Riot API, se houver Riot ID
        ├── Riot Data Dragon, para imagem
        ├── Gemini 2.5 Flash + Google Search
        └── PATCH na resposta original do Discord
```

O Worker usa `ctx.waitUntil()` para continuar o processamento depois de devolver o ACK inicial ao Discord. As consultas têm timeouts internos para permanecer dentro da janela do Cloudflare Workers.

---

# 1. Pré-requisitos

Você precisa de contas gratuitas em:

- GitHub: https://github.com/
- Cloudflare: https://dash.cloudflare.com/
- Discord Developer Portal: https://discord.com/developers/applications
- Google AI Studio: https://aistudio.google.com/apikey
- Riot Developer Portal, opcional para resultados exatos de jogadores: https://developer.riotgames.com/

No computador:

- Git
- Node.js 20 ou superior; Node 22 recomendado
- npm

Confira:

```bash
node --version
npm --version
git --version
```

---

# 2. Preparar o projeto localmente

Entre na pasta extraída:

```bash
cd oraculo-discord
npm ci
npm run check
```

O comando `npm run check` executa:

- TypeScript typecheck;
- testes automatizados com Vitest.

Para criar o arquivo local de configuração:

### Linux/macOS/Git Bash

```bash
cp .dev.vars.example .dev.vars
```

### PowerShell

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Nunca faça commit do `.dev.vars`. Ele já está no `.gitignore`.

---

# 3. Criar e configurar o app no Discord

## 3.1 Criar a aplicação

1. Acesse o Discord Developer Portal.
2. Clique em **New Application**.
3. Dê o nome `Oráculo`.
4. Na página **General Information**, copie:
   - **Application ID**;
   - **Public Key**.

Guarde como:

```text
DISCORD_APPLICATION_ID
DISCORD_PUBLIC_KEY
```

## 3.2 Criar o token do bot

1. Abra a seção **Bot**.
2. Clique em **Reset Token** ou gere o token.
3. Copie o valor imediatamente.

Guarde como:

```text
DISCORD_BOT_TOKEN
```

Não publique esse token e não o coloque no repositório.

Este MVP não precisa de **Message Content Intent**, porque recebe apenas slash commands por HTTP.

## 3.3 Configurar instalação

Na seção **Installation**:

1. Habilite **Guild Install**.
2. Em scopes, selecione:
   - `applications.commands`;
   - `bot`.
3. Para o bot, selecione as permissões:
   - Send Messages;
   - Embed Links;
   - Attach Files.
4. Copie o link de instalação.
5. Abra o link e instale o app no servidor dos seus amigos.

## 3.4 Copiar o Guild ID

No Discord normal:

1. Abra **Configurações do Usuário → Avançado**.
2. Ative **Modo desenvolvedor**.
3. Clique com o botão direito no servidor.
4. Clique em **Copiar ID do servidor**.

Guarde como:

```text
DISCORD_GUILD_ID
```

O workflow usa esse mesmo ID para:

- registrar `/oraculo` diretamente nesse servidor;
- impedir que outro servidor utilize o Worker.

---

# 4. Criar a chave do Gemini

1. Acesse o Google AI Studio.
2. Abra **Get API key**.
3. Crie uma chave para um projeto.
4. Copie o valor.

Guarde como:

```text
GEMINI_API_KEY
```

O modelo padrão está em `wrangler.jsonc`:

```json
"GEMINI_MODEL": "gemini-2.5-flash"
```

Também está habilitado:

```json
"ENABLE_GOOGLE_SEARCH": "true"
```

Isso permite responder sobre patches, builds, notícias e resultados atuais, retornando fontes.

---

# 5. Criar a chave da Riot

Essa parte é opcional para o restante do bot, mas necessária para consultas exatas como:

```text
/oraculo pergunta: qual foi a última partida de Kaic#BR1?
```

1. Entre em https://developer.riotgames.com/ com sua conta Riot.
2. Copie sua Development API Key.
3. Guarde como:

```text
RIOT_API_KEY
```

A chave de desenvolvimento expira a cada 24 horas. Para um bot de comunidade privada, registre o projeto e solicite uma **Personal API Key**. Enquanto isso, atualize o secret quando a development key expirar.

O MVP está configurado para contas do Brasil e Américas:

```json
"RIOT_ROUTING_REGION": "americas"
```

O parser reconhece Riot IDs simples no formato:

```text
Nome#TAG
```

---

# 6. Criar a conta e o token da Cloudflare

## 6.1 Account ID

1. Entre no painel da Cloudflare.
2. Abra **Workers & Pages**.
3. Copie o **Account ID** exibido no painel da conta.

Guarde como:

```text
CLOUDFLARE_ACCOUNT_ID
```

## 6.2 API Token para o GitHub

1. No painel da Cloudflare, abra **My Profile → API Tokens** ou a página de Account API Tokens.
2. Clique em **Create Token**.
3. Em permissões/custom templates, selecione **Edit Cloudflare Workers**.
4. Restrinja o token somente à sua conta.
5. Gere e copie o token.

Guarde como:

```text
CLOUDFLARE_API_TOKEN
```

---

# 7. Criar o repositório no GitHub

Crie um repositório vazio chamado, por exemplo:

```text
oraculo-discord
```

Não marque a opção para criar README, porque este projeto já contém um.

Na pasta local:

```bash
git init
git add .
git commit -m "feat: cria MVP do Oráculo"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/oraculo-discord.git
git push -u origin main
```

Troque `SEU_USUARIO` pelo seu usuário no GitHub.

---

# 8. Configurar secrets no GitHub

No repositório:

1. Abra **Settings**.
2. Vá em **Secrets and variables → Actions**.
3. Clique em **New repository secret**.
4. Cadastre todos os secrets abaixo.

| Secret | Origem |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Conta Cloudflare |
| `CLOUDFLARE_API_TOKEN` | API Token Cloudflare |
| `DISCORD_APPLICATION_ID` | General Information do Discord |
| `DISCORD_PUBLIC_KEY` | General Information do Discord |
| `DISCORD_BOT_TOKEN` | Seção Bot do Discord |
| `DISCORD_GUILD_ID` | ID do servidor Discord |
| `GEMINI_API_KEY` | Google AI Studio |
| `RIOT_API_KEY` | Riot Developer Portal |

O `RIOT_API_KEY` é opcional no código, mas o workflow incluído espera que o secret exista. Para começar sem Riot API, remova `RIOT_API_KEY` das seções `secrets` e `env` de `.github/workflows/deploy.yml`.

---

# 9. Executar o deploy automático

O arquivo já incluído é:

```text
.github/workflows/deploy.yml
```

Ele executa:

- em pull requests: typecheck e testes;
- em push para `main`: validação, deploy, sincronização dos secrets e registro do `/oraculo`;
- manualmente: botão **Run workflow**.

Depois de cadastrar os secrets:

1. Abra a aba **Actions** do repositório.
2. Abra o workflow **CI e deploy do Oráculo**.
3. Clique em **Run workflow**.
4. Aguarde os jobs `validate` e `deploy` ficarem verdes.
5. Abra o **Job summary** e copie a URL do Worker.

Ela será parecida com:

```text
https://oraculo-discord.SEUSUBDOMINIO.workers.dev
```

## Possível bootstrap do primeiro deploy

Normalmente o GitHub Action consegue criar o Worker e aplicar os secrets. Se a primeira execução falhar porque o Worker ainda não existe, faça uma única publicação local:

```bash
npx wrangler login
npm run deploy
```

Depois, volte ao GitHub Actions e execute o workflow novamente. Os próximos deploys serão automáticos.

---

# 10. Configurar o Interactions Endpoint no Discord

Depois que o Worker estiver publicado:

1. Volte ao Discord Developer Portal.
2. Abra sua aplicação.
3. Vá em **General Information**.
4. Em **Interactions Endpoint URL**, coloque:

```text
https://oraculo-discord.SEUSUBDOMINIO.workers.dev/interactions
```

5. Clique em **Save Changes**.

O Discord enviará um PING assinado ao endpoint. Se os secrets estiverem corretos, a URL será aceita.

---

# 11. Testar no servidor

No Discord, escreva:

```text
/oraculo
```

Selecione o comando e preencha o argumento `pergunta`:

```text
qual a melhor build de MF ADC no patch atual?
```

O fluxo esperado é:

1. o Discord mostra o bot pensando;
2. o Worker consulta as fontes;
3. a mensagem é editada com a resposta;
4. se um campeão do LoL for identificado, aparece o ícone;
5. se a busca retornar fontes, elas aparecem no final do embed.

Teste também:

```text
/oraculo pergunta: qual foi a última partida de Nome#TAG?
```

---

# 12. Health check e logs

Abra no navegador:

```text
https://oraculo-discord.SEUSUBDOMINIO.workers.dev/health
```

Resposta esperada:

```json
{
  "ok": true,
  "service": "oraculo-discord",
  "environment": "production",
  "model": "gemini-2.5-flash",
  "googleSearch": true,
  "riotIntegration": true
}
```

Para logs locais:

```bash
npx wrangler tail
```

Ou use **Cloudflare Dashboard → Workers & Pages → oraculo-discord → Logs**.

---

# 13. Desenvolvimento local

Preencha `.dev.vars`:

```dotenv
DISCORD_PUBLIC_KEY=...
DISCORD_APPLICATION_ID=...
GEMINI_API_KEY=...
RIOT_API_KEY=...
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
ALLOWED_GUILD_IDS=SEU_GUILD_ID
```

Execute:

```bash
npm run dev
```

O health check local estará em uma URL semelhante a:

```text
http://localhost:8787/health
```

Para testar interactions do Discord localmente, você precisaria expor o Worker com um túnel HTTPS. Para este MVP, o fluxo mais simples é testar diretamente no domínio `workers.dev`.

---

# 14. Registrar o comando manualmente

O GitHub Action já faz isso, mas você também pode registrar localmente:

```bash
npm run register:command
```

O script lê `.dev.vars`.

Com `DISCORD_GUILD_ID` preenchido, cria um **guild command**, que aparece imediatamente no servidor. Sem esse valor, cria um comando global.

---

# 15. Atualizações futuras

Depois da configuração inicial, o fluxo normal é apenas:

```bash
git add .
git commit -m "feat: melhora respostas do Oráculo"
git push
```

O GitHub Actions:

1. executa os testes;
2. publica o Worker;
3. sincroniza secrets;
4. atualiza o slash command.

---

# 16. Configurações úteis

Edite `wrangler.jsonc` para alterar variáveis não sensíveis:

```jsonc
{
  "vars": {
    "GEMINI_MODEL": "gemini-2.5-flash",
    "ENABLE_GOOGLE_SEARCH": "true",
    "RIOT_ROUTING_REGION": "americas",
    "ENVIRONMENT": "production"
  }
}
```

Não coloque chaves ou tokens nesse arquivo.

---

# 17. Troubleshooting

## O Discord mostra “This interaction failed”

Verifique:

- `Interactions Endpoint URL`;
- `DISCORD_PUBLIC_KEY`;
- logs do Worker;
- se o deploy terminou com sucesso.

## O Discord não aceita o endpoint

A causa mais comum é `DISCORD_PUBLIC_KEY` incorreta ou secrets ainda não aplicados ao Worker.

Confira `/health`, aplique os secrets e tente salvar novamente.

## O `/oraculo` não aparece

Verifique:

- `DISCORD_GUILD_ID`;
- se o app foi instalado no servidor correto;
- scope `applications.commands`;
- execução do passo `Registrar ou atualizar /oraculo no servidor` no GitHub Actions.

Execute manualmente:

```bash
npm run register:command
```

## A consulta de última partida não funciona

Provavelmente a chave da Riot expirou.

1. gere uma nova development key;
2. atualize `RIOT_API_KEY` no GitHub;
3. abra Actions;
4. execute **Run workflow**.

O restante do bot continua funcionando mesmo se a Riot API falhar; ele apenas segue sem o dado estruturado da partida.

## Gemini retorna 429

A cota gratuita foi atingida. Aguarde o reset da cota ou desabilite temporariamente a pesquisa:

```json
"ENABLE_GOOGLE_SEARCH": "false"
```

## A resposta demora e falha

O Cloudflare permite apenas uma janela curta após o ACK. O código limita:

- Data Dragon: aproximadamente 5 segundos;
- Riot API: aproximadamente 6 segundos;
- Gemini: aproximadamente 18 segundos.

Faça uma pergunta mais específica ou tente novamente.

## Não apareceu imagem

O MVP não gera imagens por IA. Ele adiciona uma imagem quando consegue identificar um campeão do LoL via Data Dragon. Para Deadlock e notícias gerais, a resposta pode ser somente texto e links.

---

# 18. Segurança

- Nunca faça commit de `.dev.vars`.
- Nunca exponha o bot token.
- Use GitHub Actions Secrets.
- Restrinja o Cloudflare API Token somente à sua conta.
- O Worker valida a assinatura Ed25519 de todas as interactions.
- `ALLOWED_GUILD_IDS` é preenchido com o seu `DISCORD_GUILD_ID` durante o deploy.
- Mentions são desabilitadas nas respostas para evitar `@everyone` e `@here` gerados pelo modelo.
- No free tier do Gemini, não envie conteúdo privado ou sensível do servidor.

---

# 19. Estrutura do projeto

```text
.
├── .github/workflows/deploy.yml
├── scripts/
│   ├── delete-command.mjs
│   └── register-command.mjs
├── src/
│   ├── datadragon.ts
│   ├── discord.ts
│   ├── gemini.ts
│   ├── index.ts
│   ├── prompts.ts
│   ├── riot.ts
│   ├── types.ts
│   └── utils.ts
├── test/utils.test.ts
├── .dev.vars.example
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
└── wrangler.jsonc
```

---

## Limitações conscientes do MVP

- A janela de background do Worker é curta; não é um agente de pesquisa de vários minutos.
- Resultados exatos de contas de LoL dependem da Riot API.
- A integração da Riot está preparada para a região `americas`.
- O parser de Riot ID prioriza nomes sem espaço.
- A imagem automática está implementada inicialmente para campeões de LoL.
- A resposta do Gemini é truncada para caber nos limites de embed do Discord.
- Cotas gratuitas e preços das plataformas podem mudar.

---

## Licença

MIT.
