// src/types.ts

import { Context, SessionFlavor } from "grammy";

/**
 * Extend 'SessionData' to list every conversation state you use,
 * plus any temporary fields for multi-step flows.
 */
export interface SessionData {
  // Existing fields
  token?: string;
  email?: string;
  sid?: string;
  isAuthenticated: boolean;

  /**
   * 'awaiting' enumerates all possible states for multi-step flows:
   *  - "email", "otp" => login flow
   *  - "deposit-amount", "deposit-chain" => deposit flow
   *  - "sendEmail-enter-email", "sendEmail-enter-amount" => 2-step send flow
   *  - "withdrawWallet-enter-address", "withdrawWallet-enter-amount" => 2-step withdraw
   *  - "offramp-enter-invoice" => 1-step bank offramp
   *  - "none" => idle
   */
  awaiting:
    | "none"
    | "email"
    | "otp"
    | "deposit-amount"
    | "deposit-chain"
    | "sendEmail-enter-email"
    | "sendEmail-enter-amount"
    | "withdrawWallet-enter-address"
    | "withdrawWallet-enter-amount"
    | "offramp-enter-invoice"
    
    ;


  // for deposit flow
  depositAmount?: number;

  // for send email flow
  tempRecipientEmail?: string;

  // for withdraw flow
  tempWithdrawAddress?: string;
}

export type MyContext = Context & SessionFlavor<SessionData>;
