import "dotenv/config";
import dotenv from "dotenv";

dotenv.config({ path: ".dev.vars", override: false });

const applicationId = process.env.DISCORD_APPLICATION_ID?.trim();
const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();
const commandId = process.env.DISCORD_COMMAND_ID?.trim();

if (!applicationId || !botToken || !commandId) {
  console.error("Defina DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN e DISCORD_COMMAND_ID.");
  process.exit(1);
}

const endpoint = guildId
  ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands/${commandId}`
  : `https://discord.com/api/v10/applications/${applicationId}/commands/${commandId}`;

const response = await fetch(endpoint, {
  method: "DELETE",
  headers: {
    Authorization: `Bot ${botToken}`
  }
});

if (!response.ok) {
  console.error(`Falha ao apagar comando: ${response.status} ${await response.text()}`);
  process.exit(1);
}

console.log("Comando removido.");
