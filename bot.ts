import { Bot } from "grammy";
import * as dotenv from "dotenv";


dotenv.config();
//Create instance of bot class and pass bot token via env var

const bot = new Bot(process.env.BOT_TOKEN!);

//Handle start command 
bot.command("start", (ctx) => ctx.reply("MVP Stage 1"));

bot.on("message", (ctx) => ctx.reply("Got another message!"));

bot.start();

