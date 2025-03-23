import { Composer } from "grammy";
import { MyContext } from "../types";
import {
  transferToEmail,
  withdrawToExternalWallet,
  withdrawToBank,
  listTransfers,
} from "../services/copperxApi";

const transfer = new Composer<MyContext>();

/**
 * /sendEmail <recipientEmail> <amount> <currency=USD> <purposeCode=self>
 * 
 * Simple usage example:
 *   /sendEmail user@example.com 50
 *   /sendEmail user@example.com 50 USDC business
 */
transfer.command("sendEmail", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ You must /login before sending funds.");
    return;
  }

  const parts = ctx.message?.text.trim().split(" ");
  // Expecting something like:
  // ["/sendEmail","recipientEmail","amount","currency?","purposeCode?"]
  if (!parts || parts.length < 3) {
    await ctx.reply(
      "Usage: /sendEmail <recipientEmail> <amount> [currency=USD] [purposeCode=self]"
    );
    return;
  }
  const [cmd, recipientEmail, amount, currency = "USD", purposeCode = "self"] = parts;

  try {
    const resp = await transferToEmail(ctx.session.token, {
      email: recipientEmail,
      amount: amount,
      currency,
      purposeCode,
    });

    // Show success
    await ctx.reply(
      `✅ *Transfer initiated!*\n\n` +
      `• Transfer ID: \`${resp.id}\`\n` +
      `• Amount: \`${resp.amount} ${resp.currency}\`\n` +
      `• Status: \`${resp.status}\`\n`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("transferToEmail error:", err);
    await ctx.reply(`❌ Failed to send funds: ${err.message}`);
  }
});

/**
 * /withdrawWallet <walletAddress> <amount> <currency=USD> <purposeCode=self>
 * 
 * Example:
 *   /withdrawWallet 0x123abc 100
 *   /withdrawWallet 0x123abc 100 USDC gift
 */
transfer.command("withdrawWallet", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please /login first.");
    return;
  }

  const parts = ctx.message?.text.trim().split(" ");
  if (!parts || parts.length < 3) {
    await ctx.reply(
      "Usage: /withdrawWallet <walletAddress> <amount> [currency=USD] [purposeCode=self]"
    );
    return;
  }

  const [cmd, walletAddress, amount, currency = "USD", purposeCode = "self"] = parts;
  try {
    const resp = await withdrawToExternalWallet(ctx.session.token, {
      walletAddress,
      amount,
      purposeCode,
      currency,
    });

    // Show success
    await ctx.reply(
      `✅ *External Wallet Withdrawal Initiated!*\n\n` +
      `• Transfer ID: \`${resp.id}\`\n` +
      `• Amount: \`${resp.amount} ${resp.currency}\`\n` +
      `• Status: \`${resp.status}\`\n`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("withdrawToExternalWallet error:", err);
    await ctx.reply(`❌ Failed to withdraw: ${err.message}`);
  }
});

/**
 * /offramp <invoiceNumber> ...
 * Minimal approach. For real usage, you might want multi-step instructions.
 *
 * Example:
 *   /offramp 123ABC
 */
transfer.command("offramp", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please /login first.");
    return;
  }

  const parts = ctx.message?.text.trim().split(" ");
  if (!parts || parts.length < 2) {
    await ctx.reply("Usage: /offramp <invoiceNumber> [other optional fields?]");
    return;
  }

  // We’ll just capture invoiceNumber, everything else is hardcoded
  const invoiceNumber = parts[1];
  try {
    const resp = await withdrawToBank(ctx.session.token, {
      invoiceNumber,
      // minimal fields
      purposeCode: "self",
      sourceOfFunds: "salary",
      recipientRelationship: "self",
    });

    await ctx.reply(
      `✅ *Bank Offramp Initiated!*\n\n` +
      `• Transfer ID: \`${resp.id}\`\n` +
      `• Status: \`${resp.status}\`\n` +
      `• Invoice: \`${resp.invoiceNumber}\`\n`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("withdrawToBank error:", err);
    await ctx.reply(`❌ Failed to do bank offramp: ${err.message}`);
  }
});

/**
 * /listTransfers <page=1> <limit=5>
 * Show most recent transfers or a specific page.
 */
transfer.command("listTransfers", async (ctx) => {
  if (!ctx.session.isAuthenticated || !ctx.session.token) {
    await ctx.reply("❌ Please /login first.");
    return;
  }

  const parts = ctx.message?.text.split(" ");
  const page = parts && parts[1] ? parseInt(parts[1], 10) : 1;
  const limit = parts && parts[2] ? parseInt(parts[2], 10) : 5;

  try {
    const res = await listTransfers(ctx.session.token, page, limit);
    // Response shape: { page, limit, data: [...] }

    if (!res || !res.data || res.data.length === 0) {
      await ctx.reply("No transfers found for your account.");
      return;
    }

    let text = `📃 *Transfers (Page ${res.page}):*\n`;
    res.data.forEach((t: any, idx: number) => {
      text += `\n*${idx + 1}.* ID: \`${t.id}\`\n`;
      text += `   Status: \`${t.status}\`, Type: \`${t.type}\`\n`;
      text += `   Amount: \`${t.amount} ${t.currency}\`\n`;
      if (t.destinationAccount?.walletAddress) {
        text += `   Destination: ${t.destinationAccount.walletAddress}\n`;
      }
    });

    await ctx.reply(text, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("listTransfers error:", err);
    await ctx.reply(`❌ Failed to list transfers: ${err.message}`);
  }
});

export default transfer;
