// src/commands/transfer.ts

import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../types";
import {
  transferToEmail,
  withdrawToExternalWallet,
  withdrawToBank,
  listTransfers,
  depositFunds,
} from "../services/copperxApi";

const transfer = new Composer<MyContext>();

/* -------------------------------------------------------------------------
   A) Slash Commands
   1) /transfer - open the inline sub-menu
   2) /deposit - single or multi-step deposit
   3) /offramp, /sendEmail, /withdrawWallet => minimal usage
   ------------------------------------------------------------------------- */

/**
 * 1) /transfer - opens the same inline sub-menu as tapping the "transfer" button.
 */
transfer.command("transfer", async (ctx) => {
  if (!ctx.session.isAuthenticated) {
    await ctx.reply("❌ Please /login first.");
    return;
  }
  const submenu = new InlineKeyboard()
    .text("📧 Send Email", "send_email_inline").row()
    .text("💸 Withdraw Wallet", "withdraw_wallet_inline").row()
    .text("🏦 Offramp Bank", "offramp_bank_inline").row()
    .text("🪙 Deposit", "deposit").row()
    .text("📜 History", "list_transfers");

  await ctx.reply("↗️ Choose a transfer option:", { reply_markup: submenu });
});

/**
 * 2) /deposit <amount=?> <chainId=?>
 * If user doesn't pass an amount, we do the multi-step approach.
 * If they pass both, we do a single-step deposit call.
 */
transfer.command("deposit", async (ctx) => {
  if (!ctx.session.isAuthenticated) {
    return await ctx.reply("❌ Please /login first.");
  }
  // SAFE way to handle ctx.message?.text so TS won't complain:
  const text = ctx.message?.text || "";
  const parts = text.trim().split(" ");
  if (parts.length < 2) {
    // No immediate amount => multi-step approach
    ctx.session.awaiting = "deposit-amount";
    await ctx.reply("🪙 Please enter the amount of USDC to deposit (minimum 1 USDC).");
    return;
  }
  // e.g. /deposit 50 137
  const amountNum = Number(parts[1]);
  if (isNaN(amountNum) || amountNum < 10) {
    return await ctx.reply("❌ Minimum deposit is 10 USDC. Usage: /deposit <amount> <chainId?>");
  }
  let chainId = 137;
  if (parts[2]) {
    const parsedChain = Number(parts[2]);
    if (isNaN(parsedChain)) {
      return await ctx.reply("❌ Invalid chain ID. Usage: /deposit <amount> <chainId?>");
    }
    chainId = parsedChain;
  }

  const amtInBaseUnits = Math.round(amountNum * 1e8).toString();
  try {
    const resp = await depositFunds(ctx.session.token!, {
      amount: amtInBaseUnits,
      sourceOfFunds: "salary",
      depositChainId: chainId,
    });
    await ctx.reply(
      `✅ *Deposit Initiated!*\n` +
      `• Transfer ID: \`${resp.id}\`\n` +
      `• Status: \`${resp.status}\`\n` +
      `• Amount: \`${amountNum} USDC\`\n` +
      `• Chain: \`${chainId}\``,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("deposit slash error:", err);
    await ctx.reply(`❌ Failed to deposit: ${err.message}`);
  }
});

/**
 * 3) /offramp <invoiceNumber> => single-step usage
 */
transfer.command("offramp", async (ctx) => {
  if (!ctx.session.isAuthenticated) {
    return await ctx.reply("❌ Please /login first.");
  }
  const text = ctx.message?.text || "";
  const parts = text.split(" ");
  if (parts.length < 2) {
    return await ctx.reply("Usage: /offramp <invoiceNumber> [other fields?]");
  }
  const invoiceNumber = parts[1];
  try {
    const resp = await withdrawToBank(ctx.session.token!, {
      invoiceNumber,
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
    console.error("offramp slash error:", err);
    await ctx.reply(`❌ Failed to do bank offramp: ${err.message}`);
  }
});

/**
 * 4) /sendEmail <recipientEmail> <amount> [currency=USD] [purposeCode=self]
 */
transfer.command("sendEmail", async (ctx) => {
  if (!ctx.session.isAuthenticated) {
    return await ctx.reply("❌ Please /login first.");
  }
  const text = ctx.message?.text || "";
  const parts = text.trim().split(" ");
  if (parts.length < 3) {
    return await ctx.reply("Usage: /sendEmail <recipientEmail> <amount> [currency=USDC] [purposeCode=self]");
  }
  const [cmd, email, amtRaw, currency = "USDC", purposeCode = "self"] = parts;
  const amount = Number(amtRaw);
  if (isNaN(amount) || amount <= 0) {
    return await ctx.reply("❌ Invalid amount. Must be > 0");
  }
  try {
    const resp = await transferToEmail(ctx.session.token!, {
      email,
      amount: amtRaw,
      currency,
      purposeCode,
    });
    await ctx.reply(
      `✅ Transfer initiated!\n` +
      `ID: \`${resp.id}\`\n` +
      `Amount: \`${resp.amount} ${resp.currency}\`\n` +
      `Status: \`${resp.status}\``,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("sendEmail slash error:", err);
    await ctx.reply(`❌ Failed to send: ${err.message}`);
  }
});

/**
 * 5) /withdrawWallet <walletAddress> <amount> [currency=USD] [purposeCode=self]
 */
transfer.command("withdrawWallet", async (ctx) => {
  if (!ctx.session.isAuthenticated) {
    return await ctx.reply("❌ Please /login first.");
  }
  const text = ctx.message?.text || "";
  const parts = text.trim().split(" ");
  if (parts.length < 3) {
    return await ctx.reply("Usage: /withdrawWallet <walletAddress> <amount> [currency=USD] [purposeCode=self]");
  }
  const [cmd, address, amtRaw, currency = "USDC", purposeCode = "self"] = parts;
  const amountNum = Number(amtRaw);
  if (isNaN(amountNum) || amountNum < 1) {
    return await ctx.reply("❌ Minimum withdraw is 1 USDC.");
  }

   // CHANGE: convert to base units for the Copperx API
  const baseUnits = Math.round(amountNum * 1e8).toString();

  try {
    const resp = await withdrawToExternalWallet(ctx.session.token!, {
      walletAddress: address,
      amount: baseUnits,
      currency,
      purposeCode,
    });
    await ctx.reply(
      `✅ External Wallet Withdrawal!\n` +
      `• Transfer ID: \`${resp.id}\`\n` +
      `• Amount: \`${resp.amount/ 1e8} ${resp.currency}\`\n` +
      `• Status: \`${resp.status}\``,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("withdrawWallet slash error:", err);
    await ctx.reply(`❌ Failed to withdraw: ${err.message}`);
  }
});

/* -------------------------------------------------------------------------
   B) Inline flows
   - "transfer" callback => sub-menu
   - "deposit" => multi-step deposit
   - "send_email_inline", "withdraw_wallet_inline", "offramp_bank_inline", etc.
   ------------------------------------------------------------------------- */

transfer.callbackQuery("transfer", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.isAuthenticated) {
    await ctx.reply("❌ Please log in to initiate transfers.");
    return;
  }
  const submenu = new InlineKeyboard()
    .text("📧 Send Email", "send_email_inline").row()
    .text("💸 Withdraw Wallet", "withdraw_wallet_inline").row()
    .text("🏦 Offramp Bank", "offramp_bank_inline").row()
    .text("🪙 Deposit", "deposit").row()
    .text("📜 History", "list_transfers");

  await ctx.reply("↗️ Choose a transfer option:", { reply_markup: submenu });
});

// Step 1 of deposit inline
transfer.callbackQuery("deposit", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.isAuthenticated) {
    return await ctx.reply("❌ Please log in first.");
  }
  ctx.session.awaiting = "deposit-amount";
  await ctx.reply("🪙 Please enter the amount of USDC to deposit (minimum 1 USDC).");
});

// Similarly, "send_email_inline", "withdraw_wallet_inline", "offramp_bank_inline"
// can set the appropriate ctx.session.awaiting state (2-step approach).

// ...

transfer.callbackQuery("list_transfers", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showTransfers(ctx, 1, 5);
});

/**
 * on("message:text") => handle multi-step flows
 * deposit-amount -> deposit-chain
 * sendEmail-enter-email -> sendEmail-enter-amount
 * withdrawWallet-enter-address -> withdrawWallet-enter-amount
 * etc.
 *
 * If user picks a chain that fails deposit, we let them re-pick by NOT setting awaiting=none
 */
transfer.on("message:text", async (ctx, next) => {
  try {
    // If there's no message, we skip
    if (!ctx.message) {
      return await next();
    }

    // e.g. deposit-amount flow
    if (ctx.session.awaiting === "deposit-amount") {
      // If user typed slash command, let them break out
      if (ctx.message.text.startsWith("/")) {
        await ctx.reply("Deposit flow aborted. Use /deposit again if you want to retry.");
        ctx.session.awaiting = "none";
        return;
      }

      const numeric = Number(ctx.message.text.trim());
      if (isNaN(numeric) || numeric < 1) {
        return await ctx.reply("❌ Minimum deposit is 1 USDC. Try again:");
      }
      ctx.session.depositAmount = numeric;
      ctx.session.awaiting = "deposit-chain";

      const chainKeyboard = new InlineKeyboard()
        .text("Ethereum (1)", "dep_chain_1").row()
        .text("Polygon (137)", "dep_chain_137").row()
        .text("Arbitrum (42161)", "dep_chain_42161").row()
        .text("Base (8453)", "dep_chain_8453").row()
        .text("Starknet (23434)", "dep_chain_23434");

      await ctx.reply("Select which network to deposit on:", {
        reply_markup: chainKeyboard,
      });
      return;
    }

    // e.g. other flows: sendEmail-enter-email => next step, etc.

    await next();
  } catch (err: any) {
    console.error("transfer on(message) error:", err);
    await ctx.reply(`❌ Transfer flow error: ${err.message}`);
    ctx.session.awaiting = "none";
  }
});

/* 
  deposit chain callback => if deposit fails, we re-show chain keyboard 
*/
transfer.callbackQuery(/dep_chain_\d+/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.isAuthenticated) {
    return await ctx.reply("❌ Please log in first.");
  }
  if (ctx.session.awaiting !== "deposit-chain") {
    return await ctx.reply("❌ Not expecting a deposit chain selection right now.");
  }
  const chainIdStr = ctx.match![0].split("_")[2];
  const chainId = Number(chainIdStr);
  const depositAmount = ctx.session.depositAmount || 0;

  // do the deposit call
  const amtInBaseUnits = Math.round(depositAmount * 1e8).toString();
  try {
    const resp = await depositFunds(ctx.session.token!, {
      amount: amtInBaseUnits,
      sourceOfFunds: "salary",
      depositChainId: chainId,
    });
    ctx.session.awaiting = "none";
    ctx.session.depositAmount = undefined;

    await ctx.reply(
      `✅ *Deposit Initiated!*\n` +
      `• Transfer ID: \`${resp.id}\`\n` +
      `• Status: \`${resp.status}\`\n` +
      `• Amount: \`${depositAmount} USDC\`\n` +
      `• Network Chain ID: \`${chainId}\``,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error("Deposit chain error:", err);
    // re-show chain selection so user can pick a diff chain
    await ctx.reply(`❌ ${err.message}\nTry a different chain?`);
    // remain in deposit-chain state
    const chainKeyboard = new InlineKeyboard()
      .text("Ethereum (1)", "dep_chain_1").row()
      .text("Polygon (137)", "dep_chain_137").row()
      .text("Arbitrum (42161)", "dep_chain_42161").row()
      .text("Base (8453)", "dep_chain_8453").row()
      .text("Starknet (23434)", "dep_chain_23434");
    await ctx.reply("Select a different network:", { reply_markup: chainKeyboard });
  }
});

/* -------------------------------------------------------------------------
   /listTransfers or inline => showTransfers helper
   ------------------------------------------------------------------------- */
transfer.command("listTransfers", async (ctx) => {
  if (!ctx.session.isAuthenticated) {
    return await ctx.reply("❌ Please /login first.");
  }
  const text = ctx.message?.text || "";
  const parts = text.split(" ");
  const page = parts[1] ? parseInt(parts[1], 10) : 1;
  const limit = parts[2] ? parseInt(parts[2], 10) : 5;
  await showTransfers(ctx, page, limit);
});

// In your `showTransfers` or whichever function prints the results:
async function showTransfers(ctx: MyContext, page: number, limit: number) {
    try {
      const res = await listTransfers(ctx.session.token!, page, limit);
      if (!res || !res.data || !res.data.length) {
        return await ctx.reply("No transfers found for your account.");
      }
      let text = `📃 *Transfers (Page ${res.page}):*\n`;
      res.data.forEach((t: any, i: number) => {
        const realAmt = Number(t.amount) / 1e8; // Divide by 1e8
  
        text += `\n*${i + 1}.* ID: \`${t.id}\`\n` +
                `   Status: \`${t.status}\`, Type: \`${t.type}\`\n` +
                // Display real USDC
                `   Amount: \`${realAmt} USDC\`\n`;
        if (t.destinationAccount?.walletAddress) {
          text += `   Destination: ${t.destinationAccount.walletAddress}\n`;
        }
      });
      await ctx.reply(text, { parse_mode: "Markdown" });
    } catch (err: any) {
      console.error("listTransfers error:", err);
      await ctx.reply(`❌ Failed to list transfers: ${err.message}`);
    }
  }
  

export default transfer;
