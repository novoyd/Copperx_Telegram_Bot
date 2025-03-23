import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../types";
import {
  listWallets,
  listWalletBalances,
  setDefaultWallet,
} from "../services/copperxApi";

const wallet = new Composer<MyContext>();

/**
 * "My Wallets" button handler.
 */
wallet.callbackQuery("wallets", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please log in to view your wallets.");
    return;
  }

  try {
    const wallets = await listWallets(ctx.session.token);
    if (!wallets || wallets.length === 0) {
      await ctx.reply("You have no wallets on Copperx.");
      return;
    }

    let response = "💼 *Your Wallets:*\n\n";
    wallets.forEach((w: any, index: number) => {
      response += `*${index + 1}.* Wallet ID: \`${w.id}\`\n` +
                  `   Address: \`${w.walletAddress}\`\n` +
                  `   Network: \`${w.network}\`\n` +
                  `   Default: \`${w.isDefault}\`\n\n`;
    });

    await ctx.reply(response, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("listWallets error:", err);
    await ctx.reply(`❌ Failed to fetch wallets: ${err.message}`);
  }
});

/**
 * "Balance" button handler.
 */
wallet.callbackQuery("balance", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please log in to check your balance.");
    return;
  }

  try {
    const walletsBalances = await listWalletBalances(ctx.session.token);

    if (!walletsBalances || walletsBalances.length === 0) {
      await ctx.reply("No wallet balances found. You might not have any wallets yet.");
      return;
    }

    let response = "💰 *Wallet Balances:*\n\n";
    walletsBalances.forEach((wb: any) => {
      response += `- Network: \`${wb.network}\`, Default: \`${wb.isDefault}\`\n`;
      wb.balances.forEach((bal: any) => {
        response += `   *${bal.symbol}*: ${bal.balance}\n`;
      });
      response += "\n";
    });

    await ctx.reply(response, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("listWalletBalances error:", err);
    await ctx.reply(`❌ Failed to fetch balances: ${err.message}`);
  }
});

/**
 * "Transfer" button handler - still a stub for demonstration, but can be expanded.
 */
wallet.callbackQuery("transfer", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.isAuthenticated) {
    await ctx.reply("❌ Please log in to initiate transfers.");
    return;
  }
  // Here you'd implement a conversation flow to ask for recipient, amount, etc.
  await ctx.reply("↗️ Transfer functionality will be added soon.");
});

/**
 * Example: set default wallet command (just a demonstration).
 * Not mapped to a callback yet, but you could build an inline keyboard to choose a wallet.
 */
wallet.command("setwallet", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please log in first.");
    return;
  }
  const input = ctx.message?.text.split(" ");
  if (input && input[1]) {
    try {
      const walletId = input[1];
      const result = await setDefaultWallet(ctx.session.token, walletId);
      await ctx.reply(`✅ Default wallet updated to: \`${result.id}\``, {
        parse_mode: "Markdown",
      });
    } catch (err: any) {
      console.error("setDefaultWallet error:", err);
      await ctx.reply(`❌ Failed to set default wallet: ${err.message}`);
    }
  } else {
    await ctx.reply("⚠️ Usage: /setwallet <walletId>");
  }
});

export default wallet;
