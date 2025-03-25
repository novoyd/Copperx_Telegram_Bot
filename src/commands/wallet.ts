// src/commands/wallet.ts

import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../types";
import {
  getKycStatus,
  listWallets,
  listWalletBalances,
  setDefaultWallet,
  getUserProfile,
} from "../services/copperxApi";

/**
 * CHANGE: getNetworkName now includes chainId=1 => Ethereum, etc.
 * We expanded the switch to cover more networks if needed.
 */
function getNetworkName(chainId: string | number): string {
  switch (chainId.toString()) {
    case "1":    return "Ethereum";
    case "137":  return "Polygon";
    case "42161":return "Arbitrum";
    case "8453": return "Base";
    case "23434":return "Starknet";
    default:     return `Chain #${chainId}`;
  }
}

const wallet = new Composer<MyContext>();

/* --------------------------------------------------------------------------
   /kyc command to check KYC status
   CHANGE: We refined the logic to handle if data is empty or pending, 
   and show a link to https://payout.copperx.io
*/
wallet.command("kyc", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ You must be logged in to check your KYC status. Use /login first.");
    return;
  }

  try {
    const kycData = await getKycStatus(ctx.session.token);
    if (!kycData || !kycData.data || kycData.data.length === 0) {
      await ctx.reply("No KYC record found. If you haven’t started, please visit https://payout.copperx.io");
      return;
    }

    const record = kycData.data[0];
    switch (record.status) {
      case "approved":
        await ctx.reply("✅ Your KYC is approved! You can use all wallet features.");
        break;
      case "pending":
        await ctx.reply("⌛ Your KYC is still pending. Please visit https://payout.copperx.io to complete any steps.");
        break;
      case "failed":
      case "rejected":
        await ctx.reply("❌ Your KYC is rejected or failed. Please contact support or reapply at https://payout.copperx.io");
        break;
      default:
        await ctx.reply(`Your KYC status is: ${record.status}. Visit https://payout.copperx.io for details.`);
        break;
    }
  } catch (err: any) {
    console.error("KYC check error:", err);
    await ctx.reply(`❌ Failed to fetch KYC status: ${err.message}`);
  }
});

/* --------------------------------------------------------------------------
   /profile: shows the user’s profile from /api/auth/me
   CHANGE: Just clarified the formatting, no major structural change
*/
wallet.command("profile", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please /login first.");
    return;
  }
  try {
    const profile = await getUserProfile(ctx.session.token);
    await ctx.reply(
      `👤 *Profile Details*\n\n` +
      `ID: \`${profile.id}\`\n` +
      `Name: ${profile.firstName} ${profile.lastName}\n` +
      `Email: ${profile.email}\n` +
      `Role: ${profile.role}\n` +
      `Wallet Address: ${profile.walletAddress}\n` +
      `Status: ${profile.status}`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("getUserProfile error:", err);
    await ctx.reply(`❌ Could not fetch profile: ${err.message}`);
  }
});

/* --------------------------------------------------------------------------
   /mywallets and inline callback "wallets"
   CHANGE: We consolidated the logic into showWallets(ctx) to avoid duplication.
           We call getNetworkName for the chain ID.
*/
wallet.command("mywallets", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please /login first.");
    return;
  }
  await showWallets(ctx);
});

/**
 * showWallets is reused by both /mywallets and callback "wallets"
 */
async function showWallets(ctx: MyContext) {
  try {
    const wallets = await listWallets(ctx.session.token!);
    if (!wallets || wallets.length === 0) {
      await ctx.reply("You have no wallets linked to your account.");
      return;
    }

    let text = "💼 *Your Wallets:*\n";
    wallets.forEach((w: any, idx: number) => {
      text += `\n*${idx + 1}.* Wallet ID: \`${w.id}\`\n` +
              `   Address: \`${w.walletAddress}\`\n` +
              // CHANGE: Using getNetworkName for a friendlier label:
              `   Network: \`${getNetworkName(w.network)}\`\n`;
              // CHANGE: only show "Default Wallet" if w.isDefault == true
                if (w.isDefault) {
                    text += `   Default: *YES*\n`; // or "Default Wallet"
                } 
    });
    await ctx.reply(text, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("listWallets error:", err);
    await ctx.reply(`❌ Failed to fetch wallets: ${err.message}`);
  }
}

/** 
 * If user taps "My Wallets" button in the main menu => callback "wallets"
 * CHANGE: We call showWallets with the same logic as /mywallets
 */
wallet.callbackQuery("wallets", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please log in to view your wallets.");
    return;
  }
  await showWallets(ctx);
});

/* --------------------------------------------------------------------------
   /balance or inline callback "balance"
   CHANGE: Similar approach with showBalances(ctx)
*/
wallet.command("balance", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please /login first.");
    return;
  }
  await showBalances(ctx);
});

async function showBalances(ctx: MyContext) {
  try {
    const walletsBalances = await listWalletBalances(ctx.session.token!);
    if (!walletsBalances || walletsBalances.length === 0) {
      await ctx.reply("No wallet balances found. You might not have any wallets yet.");
      return;
    }

    let text = "💰 *Wallet Balances:*\n";
    walletsBalances.forEach((wb: any) => {
      text += `\n*Network:* \`${getNetworkName(wb.network)}\` | *Default:* \`${wb.isDefault}\`\n`;
      wb.balances.forEach((bal: any) => {
        text += `   • ${bal.symbol}: ${bal.balance}\n`;
      });
    });
    await ctx.reply(text, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("listWalletBalances error:", err);
    await ctx.reply(`❌ Failed to fetch balances: ${err.message}`);
  }
}

/** inline callback for "balance" button => showBalances */
wallet.callbackQuery("balance", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please log in to check your balance.");
    return;
  }
  await showBalances(ctx);
});

/**
 * inline callback "transfer" was here as a stub. 
 * We leave a short note or route it to transfer.ts. 
 * CHANGE: We mention "↗️ Transfer is handled in transfer.ts" or something similar.
 */
wallet.callbackQuery("transfer", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.isAuthenticated) {
    await ctx.reply("❌ Please log in to initiate transfers.");
    return;
  }
  await ctx.reply("↗️ Transfer functionality is implemented in transfer.ts (Use slash commands or the /transfer menu).");
});

/* --------------------------------------------------------------------------
   /setwallet <walletId>
   CHANGE: We do a quick usage check, call setDefaultWallet, and confirm.
*/
wallet.command("setwallet", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please /login first.");
    return;
  }
  const input = ctx.message?.text.split(" ");
  if (!input || input.length < 2) {
    await ctx.reply("Usage: /setwallet <walletId>");
    return;
  }
  const walletId = input[1];

  try {
    const result = await setDefaultWallet(ctx.session.token, walletId);
    await ctx.reply(
      `✅ Default wallet updated to: \`${result.id}\`\n` +
      `Network: ${getNetworkName(result.network)}\nAddress: ${result.walletAddress}`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("setDefaultWallet error:", err);
    await ctx.reply(`❌ Failed to set default wallet: ${err.message}`);
  }
});

/**
 * /getdefault (optional): fetch /api/wallets/default
 * CHANGE: We left it for completeness, or user can see which is default.
 */
wallet.command("getdefault", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please /login first.");
    return;
  }
  try {
    const resp = await fetch(
      `${process.env.COPPERX_API_BASE || "https://income-api.copperx.io"}/api/wallets/default`,
      { headers: { Authorization: `Bearer ${ctx.session.token}` } }
    );
    if (!resp.ok) {
      const errBody = await resp.json();
      throw new Error(errBody.error || "Unknown error");
    }
    const defaultWallet = await resp.json();
    await ctx.reply(
      `*Default Wallet:*\n\n` +
      `\`ID:\` ${defaultWallet.id}\n` +
      `\`Address:\` ${defaultWallet.walletAddress}\n` +
      `\`Network:\` ${getNetworkName(defaultWallet.network)}\n`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("getDefaultWallet error:", err);
    await ctx.reply(`❌ Could not fetch default wallet: ${err.message}`);
  }
});

export default wallet;
