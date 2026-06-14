import "dotenv/config";
import dotenv from "dotenv";

dotenv.config({ path: ".dev.vars", override: false });

const applicationId = process.env.DISCORD_APPLICATION_ID?.trim();
const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();

if (!applicationId || !botToken) {
  console.error("Defina DISCORD_APPLICATION_ID e DISCORD_BOT_TOKEN em .dev.vars ou no ambiente.");
  process.exit(1);
}

const command = {
  name: "oraculo",
  type: 1,
  description: "Pergunte sobre LoL, Deadlock, patches, builds, notícias e partidas",
  dm_permission: false,
  options: [
    {
      type: 3,
      name: "pergunta",
      description: "Ex.: qual a melhor build de Infernus híbrido no patch atual?",
      required: true,
      min_length: 3,
      max_length: 1200
    }
  ]
};

const endpoint = guildId
  ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${applicationId}/commands`;

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(command)
});

const payload = await response.json();
if (!response.ok) {
  console.error("Falha ao registrar comando:", JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(
  guildId
    ? `Comando /oraculo registrado imediatamente no servidor ${guildId}.`
    : "Comando /oraculo registrado globalmente. A propagação pode levar algum tempo."
);
console.log(JSON.stringify(payload, null, 2));
