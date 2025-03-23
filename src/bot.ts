import { Bot,session, InlineKeyboard, MemorySessionStorage } from "grammy";
import {freeStorage} from "@grammyjs/storage-free";
import dotenv from "dotenv";
import { MyContext, SessionData } from "./types";
import auth from "./commands/auth";
import wallet from "./commands/wallet";

/*right now I want to basically be able to send and call
the auth api over here
*/

dotenv.config();
//Create instance of bot class and pass bot token via env var

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);
console.log("DEBUG BOT_TOKEN:", process.env.BOT_TOKEN);
if (!process.env.BOT_TOKEN) throw new Error("No BOT_TOKEN! Check your .env or environment.");


bot.use(session({
    initial: (): SessionData => ({
        token: undefined,
        email: undefined,
        sid: undefined, 
        isAuthenticated: false,
        awaiting: "none",
    }),
    //Whats session data over here representing
        
    storage: new MemorySessionStorage(),

}));



bot.use(auth);
bot.use(wallet);


//Handle start command isnt it async by default over here since its JS
bot.command("start", async (ctx) => {
    //Im guessing these are various states? 
    if (ctx.session.isAuthenticated) {
        const menuKeyboard = new InlineKeyboard()
        .text("💼 My Wallets", "wallets").text("💰 Balance", "balance").row()
      .text("↗️ Transfer", "transfer").text("🔓 Logout", "logout");
    await ctx.reply(`🤖 Welcome back, ${ctx.session.email || "user"}!`, {
      reply_markup: menuKeyboard,
    });
    } else {
        const loginKeyboard = new InlineKeyboard().text("🔐 Log In", "login");
        await ctx.reply(
            "🤖 Welcome to the Copperx Bot.\nPlease log in to access your wallet and manage your funds.",
            { reply_markup: loginKeyboard }
          );
        }
    });

bot.command("help", async (ctx) => {
    await ctx.reply(
        "ℹ️ *Copperx Bot Help*\n" +
        "- /start to begin.\n" +
        "- /login or 'Log In' button to authenticate.\n" +
        "- /logout to log out.\n" +
        "- /cancel to cancel any in-progress operation.\n" +
        "- Or use the inline buttons (Balance, Transfer, etc.).",
        { parse_mode: "Markdown" }
    );
});

//Basically switches the bot on  
bot.on("message:text", async (ctx) => { 
   if (ctx.session.awaiting === "none") {
    await ctx.reply("🤔 I didn't understand that. Type /help for usage.");
   }
});

//Global error handler

bot.catch(async(err) => {
    console.error("Error occured:", err);
    const ctx = err.ctx;
    try {
        await ctx.reply("❌ An error occurred. Please try again later.");
    } catch(e) {
        console.error("Failed to send error message:", e);
    }
});

bot.start();
