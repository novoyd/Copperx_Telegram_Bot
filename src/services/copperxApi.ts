// src/services/copperxApi.ts

import axios, { AxiosError } from "axios";

/** 
 * CHANGE: Now we have depositFunds(...) 
 * also we updated getNetworkName usage references to remain consistent
 */
const COPPERX_API_BASE = process.env.COPPERX_API_BASE || "https://income-api.copperx.io";

/** 
 * We create an axios instance, optionally with Bearer token in headers.
 */
function createCopperxClient(token?: string) {
  return axios.create({
    baseURL: COPPERX_API_BASE,
    timeout: 10_000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Helper to parse axios errors into friendly strings. */
function getAxiosErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError;
    const statusCode = axErr.response?.status;
    const data = axErr.response?.data as any;
    if (data?.error) {
      return `Error ${statusCode}: ${data.error}`;
    }
    if (data?.message) {
      return typeof data.message === "string" ? data.message : JSON.stringify(data.message);
    }
    return `Request failed with status ${statusCode}`;
  }
  return (err as Error).message || "Unknown error occurred";
}

// 1) AUTH (same as before, but we log more clearly)
export async function requestEmailOtp(email: string) {
  try {
    const client = createCopperxClient();
    const resp = await client.post("/api/auth/email-otp/request", { email });
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}

export async function verifyEmailOtp(email: string, otp: string, sid: string) {
  try {
    const client = createCopperxClient();
    const payload: Record<string, string> = { email, otp };
    if (sid) payload.sid = sid;
    const resp = await client.post("/api/auth/email-otp/authenticate", payload);
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}

export async function getUserProfile(token: string) {
  try {
    const client = createCopperxClient(token);
    const resp = await client.get("/api/auth/me");
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}

export async function getKycStatus(token: string) {
  try {
    const client = createCopperxClient(token);
    const resp = await client.get("/api/kycs", { params: { page: 1, limit: 1 } });
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}

// 2) Wallet endpoints (unchanged except for error logs)
export async function listWallets(token: string) {
  try {
    const client = createCopperxClient(token);
    const resp = await client.get("/api/wallets");
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}

export async function listWalletBalances(token: string) {
  try {
    const client = createCopperxClient(token);
    const resp = await client.get("/api/wallets/balances");
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}

export async function setDefaultWallet(token: string, walletId: string) {
  try {
    const client = createCopperxClient(token);
    const resp = await client.post("/api/wallets/default", { walletId });
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}

// 3) Transfer endpoints: /api/transfers/...
export async function transferToEmail(token: string, args: any) {
  try {
    const client = createCopperxClient(token);
    const resp = await client.post("/api/transfers/send", args);
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}

export async function withdrawToExternalWallet(token: string, args: any) {
  try {
    const client = createCopperxClient(token);
    const resp = await client.post("/api/transfers/wallet-withdraw", args);
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}

export async function withdrawToBank(token: string, args: any) {
  try {
    const client = createCopperxClient(token);
    const resp = await client.post("/api/transfers/offramp", args);
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}

/**
 * CHANGE: depositFunds is new. 
 * POST /api/transfers/deposit with the fields { amount, sourceOfFunds, depositChainId, ... } 
 */
export async function depositFunds(token: string, args: {
  amount: string;
  sourceOfFunds: string;
  depositChainId: number;
  purposeCode?: string;
  recipientRelationship?: string;
}) {
  try {
    const client = createCopperxClient(token);
    const resp = await client.post("/api/transfers/deposit", args);
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}

export async function listTransfers(token: string, page = 1, limit = 10) {
  try {
    const client = createCopperxClient(token);
    const resp = await client.get("/api/transfers", { params: { page, limit } });
    return resp.data;
  } catch (err) {
    throw new Error(getAxiosErrorMessage(err));
  }
}
