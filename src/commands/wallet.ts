import { Composer,InlineKeyboard } from "grammy";
import { MyContext } from "../types";
import {
  getKycStatus,
  listWallets,
  listWalletBalances,
  setDefaultWallet,
  getUserProfile,
} from "../services/copperxApi";

const wallet = new Composer<MyContext>();

/**
 * /kyc command: Checks user’s KYC status.
 * - If 'pending', encourage them to visit the website for further steps.
 * - If 'approved', let them continue.
 * - If something else, display it.
 */
wallet.command("kyc", async (ctx) => {
  // Must be authenticated
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ You must be logged in to check your KYC status. Use /login first.");
    return;
  }

  try {
    const kycData = await getKycStatus(ctx.session.token);
    // The API returns a paginated list. For example:
    // { page:1, limit:1, data: [ { status: 'pending', ... } ]}
    if (!kycData || !kycData.data || kycData.data.length === 0) {
      await ctx.reply("No KYC record found. If you haven’t started, please visit https://payout.copperx.io");
      return;
    }

    const record = kycData.data[0]; // typically the first record
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

/**
 * /profile command: Show the user’s profile details (from /api/auth/me).
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
        `Wallet: ${profile.walletAddress}\n` +
        `Status: ${profile.status}\n`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("getUserProfile error:", err);
    await ctx.reply(`❌ Could not fetch profile: ${err.message}`);
  }
});

/**
 * /mywallets command: Lists all wallets for the user.
 */
wallet.command("mywallets", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please /login first.");
    return;
  }
  try {
    const wallets = await listWallets(ctx.session.token);
    if (!wallets || wallets.length === 0) {
      await ctx.reply("You have no wallets linked to your account.");
      return;
    }
    let text = "💼 *Your Wallets:*\n";
    wallets.forEach((w: any, idx: number) => {
      text += `\n*${idx + 1}.* Wallet ID: \`${w.id}\`\n` +
              `   Address: \`${w.walletAddress}\`\n` +
              `   Network: \`${w.network}\`\n` +
              `   Default: \`${w.isDefault}\`\n`;
    });
    await ctx.reply(text, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("listWallets error:", err);
    await ctx.reply(`❌ Failed to fetch wallets: ${err.message}`);
  }
});

/**
 * /balance command: Show wallet balances across networks.
 */
wallet.command("balance", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please /login first.");
    return;
  }
  try {
    const walletsBalances = await listWalletBalances(ctx.session.token);
    if (!walletsBalances || walletsBalances.length === 0) {
      await ctx.reply("You have no wallet balances to show.");
      return;
    }
    let text = "💰 *Wallet Balances:*\n";
    walletsBalances.forEach((wb: any) => {
      text += `\n*Network:* \`${wb.network}\` | *Default:* \`${wb.isDefault}\`\n`;
      wb.balances.forEach((bal: any) => {
        text += `   • ${bal.symbol}: ${bal.balance}\n`;
      });
    });
    await ctx.reply(text, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("listWalletBalances error:", err);
    await ctx.reply(`❌ Failed to fetch balances: ${err.message}`);
  }
});

/**
 * /setwallet <walletId> : set a default wallet.
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
      `Network: ${result.network}\nAddress: ${result.walletAddress}`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("setDefaultWallet error:", err);
    await ctx.reply(`❌ Failed to set default wallet: ${err.message}`);
  }
});

/**
 * /getdefault : (optional) Fetch the default wallet
 */
wallet.command("getdefault", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please /login first.");
    return;
  }
  // The API path is /api/wallets/default
  try {
    const client = await fetch(`${process.env.COPPERX_API_BASE || "https://income-api.copperx.io"}/api/wallets/default`, {
      headers: { Authorization: `Bearer ${ctx.session.token}` },
    });
    if (!client.ok) {
      const errBody = await client.json();
      throw new Error(errBody.error || "Unknown error");
    }
    const defaultWallet = await client.json();
    await ctx.reply(
      `*Default Wallet:*\n\n` +
      `\`ID:\` ${defaultWallet.id}\n` +
      `\`Address:\` ${defaultWallet.walletAddress}\n` +
      `\`Network:\` ${defaultWallet.network}\n`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("getDefaultWallet error:", err);
    await ctx.reply(`❌ Could not fetch default wallet: ${err.message}`);
  }
});

export default wallet;
