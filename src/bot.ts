// src/bot.ts

import { Bot, session, InlineKeyboard } from "grammy";
import { RedisAdapter } from "@grammyjs/storage-redis";
import IORedis from "ioredis";
import dotenv from "dotenv";
import { MyContext, SessionData } from "./types";
import auth from "./commands/auth";
import wallet from "./commands/wallet";
import transfer from "./commands/transfer";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("No BOT_TOKEN! Check your .env or environment.");

//  We connect to redis and create a storage for session
const redis = new IORedis("redis://localhost:6379");
const storage = new RedisAdapter({ instance: redis, autoParseDates: true });

const bot = new Bot<MyContext>(BOT_TOKEN);

// CHANGE: We persist session in Redis with an initial shape
bot.use(session({
  initial: (): SessionData => ({
    token: undefined,
    email: undefined,
    sid: undefined,
    isAuthenticated: false,
    awaiting: "none",
  }),
  storage,
}));

// register sub-modules
bot.use(auth);
bot.use(wallet);
bot.use(transfer);

/**
 * /start command:
 * CHANGE: We added "🪙 Deposit" to the main menu for an authenticated user.
 */
bot.command("start", async (ctx) => {
  if (ctx.session.isAuthenticated) {
    const menuKeyboard = new InlineKeyboard()
      .text("💼 My Wallets", "wallets").text("💰 Balance", "balance").row()
      .text("↗️ Transfer", "transfer").text("🪙 Deposit", "deposit").row()
      .text("🔓 Logout", "logout");

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

/**
 * /help command:
 * CHANGE: We mention /deposit along with the other commands if user is logged in.
 */
bot.command("help", async (ctx) => {
  if (!ctx.session.isAuthenticated) {
    await ctx.reply(
      "You are currently logged out. Basic commands:\n\n" +
      "• /start - Show main menu\n" +
      "• /login - Email OTP login\n" +
      "• /logout - Log out\n" +
      "• /cancel - Cancel an in-progress operation\n\n" +
      "Log in to see more commands."
    );
  } else {
    await ctx.reply(
      "🔹 /mywallets - List wallets\n" +
      "🔹 /balance - Show balances\n" +
      "🔹 /setwallet <walletId> - Set default wallet\n" +
      "🔹 /sendEmail <email> <amt> [currency=USD] [purpose=self]\n" +
      "🔹 /withdrawWallet <addr> <amt> [currency=USD] [purpose=self]\n" +
      "🔹 /offramp <invoiceNumber> - Withdraw to bank\n" +
      "🔹 /listTransfers [page=1] [limit=5] - Show your transaction history\n" +
      "🔹 /deposit - Another way to deposit funds\n" +
      "\n• /logout - Log out\n" +
      "• /cancel - Cancel an in-progress operation"
    );
  }
});

/**
 * if user sends random text not in a special 'awaiting' step => 
 * "I didn't understand, type /help"
 */
bot.on("message:text", async (ctx) => {
  if (ctx.session.awaiting === "none") {
    await ctx.reply("🤔 I didn't understand that. Type /help for usage.");
  }
});

// Global error handler
bot.catch(async (err) => {
  console.error("Error occurred:", err);
  const ctx = err.ctx;
  try {
    await ctx.reply("❌ An error occurred. Please try again later.");
  } catch (e) {
    console.error("Failed to send error message:", e);
  }
});

// start polling
bot.start();
