import axios, {AxiosError} from "axios";
import { SessionData} from "../types";

/** Base URL for Copperx API */

const COPPERX_API_BASE = process.env.COPPERX_API_BASE || "https://income-api.copperx.io"

/** 
 * Create reusable axios instance config for copperx
 * Optionally u can pass a bearer token. 
 * If provided will be automatically added to Authorization headers
 */

function createCopperxClient(token?: string) {
    return axios.create({
        baseURL: COPPERX_API_BASE,
        timeout: 10_000, //10 seconds
        headers: token ? {
            Authorization: `Bearer ${token}`,
        }
        : {},
    });
}


/** 
 * Error Helper: extracts user-friendly message from axios error
 */
function getAxiosErrorMessage(err: unknown): string {
    if (axios.isAxiosError(err)) {
        const axErr = err as AxiosError;
        const statusCode = axErr.response?.status;
        const data = axErr.response?.data as any;
        //Attempt to extract error message from resp body 
        if (data?.error) {
            return `Error ${statusCode}: ${data.error}`;
        }
        if (data?.message) {
            return typeof data.message === "string" ? data.message : JSON.stringify(data.message);
        }
        return `Request failed with status ${statusCode}`;
    }
    return (err as Error).message || "Unknown error occured";
}


/** 
 * Requests an email OTP using Copperx Auth API
 * Endpoint: POST api/auth/email-otp/request
 * @param email - User's email address to send otp to 
 * @returns Object containtg email and sid from API response
 */

export async function requestEmailOtp(email:string): Promise<{email: string; sid: string | undefined}> {
    try { 
        const client = createCopperxClient();
        const response = await client.post("/api/auth/email-otp/request", {email});
        return response.data;
    } catch (err) {
        const msg = getAxiosErrorMessage(err);
        throw new Error(msg);
    }
}


/** 
 * Verifies email OTP and authenticates the user.
 * Endpoint: POST api/auth/email-otp/authenticate 
 * @param email- User's email address
 * @param OTP- One-time password received from user
 * @param sid- Session ID received from requestEmailOtp
 * @returns Object containing token details, user info,  from API response
 */
export async function verifyEmailOtp(email: string, otp: string, sid: string): Promise<{scheme: string;
    accessToken: string;
    accessTokenId: string;
    expireAt: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      organizationId: string;
      role: string;
      status: number;
      type: string;
      relayerAddress: string;
      flags: [
        "string"
      ],
      walletAddress: string;
      walletId: string;
      walletAccountType: string;
    };
    }> {
        try {
            const client = createCopperxClient();
            const payload: Record<string, string > = { email, otp};
            if (sid) {
                payload.sid = sid;
            }
            const response = await client.post("/api/auth/email-otp/authenticate", payload);
            return response.data;
        } catch (err) {
            const msg = getAxiosErrorMessage(err);
            throw new Error(msg);
        }
     }

/** 
 * Fetches users indiviudal profile information to confirm login
 * Endpoint: GET api/auth/me (requires auth header with bearer token)
 * @param token- Bearer token from verifyEmailOtp
 */

export async function getUserProfile(token: string): Promise<{ 
    
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImage: string;
    organizationId: string;
    role: string;
    status: number;
    type: string;
    relayerAddress: string;
    flags: [
      "string"
    ],
    walletAddress: string;
    walletId: string;
    walletAccountType: string;
}>

{
    try { 
        const client = createCopperxClient(token);
        const response = await client.get("api/auth/me");
        return response.data;
    } catch (err) {
        const msg = getAxiosErrorMessage(err);
        throw new Error(msg);
    }
}

/** Example: KYC status fetch: GET /api/kycs */
export async function getKycStatus(token: string) {
    try {
      const client = createCopperxClient(token);
      const response = await client.get("/api/kycs", {
        params: { page: 1, limit: 1 },
      });
      return response.data;
    } catch (err) {
      const msg = getAxiosErrorMessage(err);
      throw new Error(msg);
    }
  }
  
  /** Example: List all wallets: GET /api/wallets */
  export async function listWallets(token: string) {
    try {
      const client = createCopperxClient(token);
      const response = await client.get("/api/wallets");
      return response.data; // array of wallet objects
    } catch (err) {
      throw new Error(getAxiosErrorMessage(err));
    }
  }
  
  /** Example: Get wallets balances: GET /api/wallets/balances */
  export async function listWalletBalances(token: string) {
    try {
      const client = createCopperxClient(token);
      const response = await client.get("/api/wallets/balances");
      return response.data; // array of wallet balances
    } catch (err) {
      throw new Error(getAxiosErrorMessage(err));
    }
  }
  
  /** Example: Set default wallet: POST /api/wallets/default */
  export async function setDefaultWallet(token: string, walletId: string) {
    try {
      const client = createCopperxClient(token);
      const response = await client.post("/api/wallets/default", { walletId });
      return response.data; // new default wallet object
    } catch (err) {
      throw new Error(getAxiosErrorMessage(err));
    }
  }
  
  /** Example: Transfer to email (send funds): POST /api/transfers/send */
  export async function transferToEmail(
    token: string,
    args: {
      walletAddress?: string;
      email?: string;
      payeeId?: string;
      amount: string;
      purposeCode?: string;
      currency?: string;
    }
  ) {
    try {
      const client = createCopperxClient(token);
      const response = await client.post("/api/transfers/send", args);
      return response.data; // transfer object
    } catch (err) {
      throw new Error(getAxiosErrorMessage(err));
    }
  }
  
  /** Example: Transfer to external wallet: POST /api/transfers/wallet-withdraw */
  export async function withdrawToExternalWallet(
    token: string,
    args: {
      walletAddress: string;
      amount: string;
      purposeCode?: string;
      currency?: string;
    }
  ) {
    try {
      const client = createCopperxClient(token);
      const response = await client.post("/api/transfers/wallet-withdraw", args);
      return response.data; // transaction/transfer object
    } catch (err) {
      throw new Error(getAxiosErrorMessage(err));
    }
  }
  
  /** Example: Bank withdrawal/offramp: POST /api/transfers/offramp */
  export async function withdrawToBank(
    token: string,
    args: {
      invoiceNumber?: string;
      invoiceUrl?: string;
      purposeCode?: string;
      sourceOfFunds?: string;
      recipientRelationship?: string;
      quotePayload?: string;
      quoteSignature?: string;
      preferredWalletId?: string;
      customerData?: {
        name?: string;
        businessName?: string;
        email?: string;
        country?: string;
      };
      sourceOfFundsFile?: string;
      note?: string;
    }
  ) {
    try {
      const client = createCopperxClient(token);
      const response = await client.post("/api/transfers/offramp", args);
      return response.data; // transaction/transfer object
    } catch (err) {
      throw new Error(getAxiosErrorMessage(err));
    }
  }
  
  /** Example: List transfers: GET /api/transfers */
  export async function listTransfers(token: string, page = 1, limit = 10) {
    try {
      const client = createCopperxClient(token);
      const response = await client.get("/api/transfers", {
        params: { page, limit },
      });
      return response.data; // object with { data: [...], page, limit, etc.}
    } catch (err) {
      throw new Error(getAxiosErrorMessage(err));
    }
  }