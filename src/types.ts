import { Context, SessionFlavor} from "grammy";

/** Define shape of data we will store in this session */

export interface SessionData {
    token?: string; // Bearer token from copperx
    email?: string; // Email of logged in user 
    sid?: string; // Session ID from requestEmailOtp
    isAuthenticated: boolean; //Whehter user is logged in
    awaiting: 'none' | 'email' | 'otp';
}

/** Extend default context with session flavor to include our sessiondata */

export type MyContext = Context & SessionFlavor<SessionData>;
