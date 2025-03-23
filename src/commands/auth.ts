import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../types";
import {
  requestEmailOtp,
  verifyEmailOtp,
  getUserProfile,
} from "../services/copperxApi";
//Composer is a middleware that allows you to handle different types of updates
const auth = new Composer<MyContext>();

/** 
 * /login command or "Log In" inline button: initiates the OTP login flow.
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
 * /cancel command to abort any ongoing operation (e.g., in the middle of login).
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
 * /logout command to log the user out, or "Logout" inline button.
 */
auth.command("logout", async (ctx) => {
  if (!ctx.session.isAuthenticated) {
    await ctx.reply("ℹ️ You are not logged in.");
    return;
  }
  const prevEmail = ctx.session.email;
  // Clear session
  ctx.session.isAuthenticated = false;
  ctx.session.email = undefined;
  ctx.session.sid = undefined;
  ctx.session.token = undefined;
  ctx.session.awaiting = "none";

  await ctx.reply(`🔓 Logged out of ${prevEmail || "your account"}.`, {
    reply_markup: new InlineKeyboard().text("🔐 Log In", "login"),
  });
});

auth.callbackQuery("logout", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.isAuthenticated) {
    await ctx.reply("ℹ️ You are not logged in.");
    return;
  }
  const prevEmail = ctx.session.email;
  // Clear session
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
 * Text message handler for actual login flow (email -> request OTP, OTP -> verify).
 */
auth.on("message:text", async (ctx, next) => {
  try {// Step 1: user provides email
  if (ctx.session.awaiting === "email") {
    const email = ctx.message.text.trim();
    try {
      // requestEmailOtp now returns { email, sid }
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

  // Step 2: user provides OTP
  if (ctx.session.awaiting === "otp") {
    const otp = ctx.message.text.trim();
    if (!ctx.session.email || !ctx.session.sid) {
      await ctx.reply("❌ Something went wrong. Please /cancel and try again.");
      ctx.session.awaiting = "none";
      return;
    }
    try {
      // verifyEmailOtp now requires (email, otp, sid) to get the token and user data
      const authData = await verifyEmailOtp(ctx.session.email, otp, ctx.session.sid);

      // Grab the token from authData
      const token = authData.accessToken; // see docs: "accessToken"
      ctx.session.token = token;
      ctx.session.isAuthenticated = true;
      ctx.session.awaiting = "none";
      ctx.session.sid = undefined; // sid not needed after successful verification

      // (Optional) Fetch user profile
      let displayName: string = ctx.session.email;
      try {
        const profile = await getUserProfile(token);
        if (profile.firstName || profile.lastName) {
          displayName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
        }
      } catch (profileError) {
        console.warn("Unable to fetch profile after login:", profileError);
      }

      // Present main menu
      const menuKeyboard = new InlineKeyboard()
        .text("💼 My Wallets", "wallets").text("💰 Balance", "balance").row()
        .text("↗️ Transfer", "transfer").text("🔓 Logout", "logout");

      await ctx.reply(
        `✅ Login successful! You are now logged in as ${displayName}. What would you like to do next?`,
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

  // If we're not in email/otp flow, pass to next handlers
  await next();

} catch (err: any) {
    console.error("Unexpected auth flow error:", err);
    await ctx.reply("❌ An unexpected error occurred in the auth flow. Please try again.");
    }
});

export default auth;
