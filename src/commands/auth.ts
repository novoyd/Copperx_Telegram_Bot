// src/commands/auth.ts

import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../types";
import {
  requestEmailOtp,
  verifyEmailOtp,
  getUserProfile,
} from "../services/copperxApi";

//  This composer handles /login, /logout, inline "login"/"logout" callbacks,
// and the multi-step email+OTP flow. 

const auth = new Composer<MyContext>();

/**
 * /login command or "Log In" inline button initiates the OTP login flow.
 *  We ensure no existing operation is in progress and the user isn't already logged in.
 */
auth.command("login", async (ctx) => {
  if (ctx.session.awaiting !== "none") {
    await ctx.reply("⚠️ You're already in the middle of an operation. Send /cancel to abort first.");
    return;
  }
  if (ctx.session.isAuthenticated) {
    await ctx.reply("✅ You are already logged in. Use /logout to log out first.");
    return;
  }
  ctx.session.awaiting = "email";
  await ctx.reply("🔑 Please enter your email address to log in:");
});

/** 
 *  Inline version of the same logic for "Log In" callback.
 */
auth.callbackQuery("login", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.session.awaiting !== "none") {
    await ctx.reply("⚠️ An operation is in progress. Send /cancel to abort it first.");
    return;
  }
  if (ctx.session.isAuthenticated) {
    await ctx.reply("✅ You are already logged in. Use /logout to log out first.");
    return;
  }
  ctx.session.awaiting = "email";
  await ctx.reply("🔑 Please enter your email address to log in:");
});

/** 
 * /cancel command aborts any in-progress operation (like waiting for email or OTP).
 * We reset session.awaiting to 'none' so user can start fresh.
 */
auth.command("cancel", async (ctx) => {
  if (ctx.session.awaiting !== "none") {
    ctx.session.awaiting = "none";
    ctx.session.email = undefined;
    ctx.session.sid = undefined;
    await ctx.reply("⚠️ Operation canceled. You can /login again when ready.");
  } else {
    await ctx.reply("ℹ️ There's no ongoing operation to cancel.");
  }
});

/**
 * /logout or "Logout" inline button: clear session data and show a "Log In" button.
 *  We reset all session fields and prompt with inline "Log In."
 */
auth.command("logout", async (ctx) => {
  if (!ctx.session.isAuthenticated) {
    await ctx.reply("ℹ️ You are not logged in.");
    return;
  }
  const prevEmail = ctx.session.email;
  ctx.session.isAuthenticated = false;
  ctx.session.email = undefined;
  ctx.session.sid = undefined;
  ctx.session.token = undefined;
  ctx.session.awaiting = "none";

  await ctx.reply(`🔓 Logged out of ${prevEmail || "your account"}.`, {
    reply_markup: new InlineKeyboard().text("🔐 Log In", "login"),
  });
});

/**
 *  Inline "logout" callback is mirrored, resetting session and showing "Log In."
 */
auth.callbackQuery("logout", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.isAuthenticated) {
    await ctx.reply("ℹ️ You are not logged in.");
    return;
  }
  const prevEmail = ctx.session.email;
  ctx.session.isAuthenticated = false;
  ctx.session.email = undefined;
  ctx.session.sid = undefined;
  ctx.session.token = undefined;
  ctx.session.awaiting = "none";

  await ctx.reply(`🔓 Logged out of ${prevEmail || "your account"}.`, {
    reply_markup: new InlineKeyboard().text("🔐 Log In", "login"),
  });
});

/**
 * Text message handler: 
 *  Step 1 (email), Step 2 (OTP). 
 *  If an error occurs, we log it and show the user a friendly message.
 *  After success, we add the "🪙 Deposit" button to the main menu.
 */
auth.on("message:text", async (ctx, next) => {
  try {
    // STEP 1: user provides email
    if (ctx.session.awaiting === "email") {
      const email = ctx.message.text.trim();
      try {
        const { email: returnedEmail, sid } = await requestEmailOtp(email);
        ctx.session.email = returnedEmail;
        ctx.session.sid = sid;
        ctx.session.awaiting = "otp";

        await ctx.reply("✅ An OTP has been sent to your email. Please enter the one-time password:");
      } catch (err: any) {
        console.error("OTP request error:", err);
        const errMsg = err.message || "Failed to send OTP. Please check the email and try again.";
        await ctx.reply(`❌ ${errMsg}`);
        ctx.session.awaiting = "none";
      }
      return;
    }

    // STEP 2: user provides OTP
    if (ctx.session.awaiting === "otp") {
      const otp = ctx.message.text.trim();
      if (!ctx.session.email || !ctx.session.sid) {
        await ctx.reply("❌ Something went wrong. Please /cancel and try again.");
        ctx.session.awaiting = "none";
        return;
      }
      try {
        const authData = await verifyEmailOtp(ctx.session.email, otp, ctx.session.sid);

        ctx.session.token = authData.accessToken;
        ctx.session.isAuthenticated = true;
        ctx.session.awaiting = "none";
        ctx.session.sid = undefined;

        // OPTIONAL: fetch user profile for a display name
        let displayName: string = ctx.session.email;
        try {
          const profile = await getUserProfile(ctx.session.token!);
          if (profile.firstName || profile.lastName) {
            displayName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
          }
        } catch (profileError) {
          console.warn("Unable to fetch profile after login:", profileError);
        }

        // CHANGE: new "🪙 Deposit" button added to menuKeyboard
        const menuKeyboard = new InlineKeyboard()
          .text("💼 My Wallets", "wallets").text("💰 Balance", "balance").row()
          .text("↗️ Transfer", "transfer").text("🪙 Deposit", "deposit").row()
          .text("🔓 Logout", "logout");

        await ctx.reply(
          `✅ Login successful! You are now logged in as ${displayName}.`,
          { reply_markup: menuKeyboard }
        );
      } catch (err: any) {
        console.error("OTP verification error:", err);
        const errMsg = err.message || "Authentication failed. Please ensure the OTP is correct.";
        await ctx.reply(`❌ ${errMsg}`);
        await ctx.reply("⌛ Please enter the correct OTP, or send /cancel to abort and start over.");
      }
      return;
    }

    // fallback if not in 'email'/'otp' flow
    await next();

  } catch (err: any) {
    console.error("Unexpected auth flow error:", err);
    await ctx.reply("❌ An unexpected error occurred in the auth flow. Please try again.");
  }
});

export default auth;
