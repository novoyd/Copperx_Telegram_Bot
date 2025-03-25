1\. Design Choices
------------------

### Telegram Bot Framework

We compared **Telegraf** and **grammY** for building a Telegram bot and chose **grammY** because:

1.  **Up-to-date** with the latest Telegram Bot API versions.

2.  **Extensive documentation** compared to Telegraf's limited, auto-generated docs.

3.  **TypeScript-first approach**: Telegraf often backports JavaScript code, leading to more complex type definitions. grammY has a cleaner TypeScript integration.

Hence, grammY was a natural pick for building a strongly typed, modern Telegram bot.

* * * * *

2\. Features
------------

1.  **OTP Authentication Flow**

    -   Request an OTP via email (calls the CopperX API endpoint).

    -   Verify OTP, obtain an access token, store it in the session.

2.  **Basic Command Handlers**

    -   **`/login`** or inline "Log In" button to start the OTP flow.

    -   **`/logout`** to clear the user session.

    -   **`/cancel`** to abort any ongoing operation (like waiting for email or OTP).

3.  **Graceful Error Handling**

    -   Catches and logs CopperX API errors.

    -   Shows user-friendly messages instead of crashing.

**In the Works** (coming soon):

-   **Wallet listing and balances**

-   **Transfers** (to email, external wallet, bank off-ramp)

-   **KYC Status** checks

-   **Extended user feedback** flows

* * * * *

3\. Project Structure
---------------------

Below is a simplified view of the directory layout:

```bash


CopperX_Telegram_Bot/
├── src/
│   ├── commands/
│   │   ├── auth.ts        # Handles /login, /logout, OTP flow
│   │   ├── wallet.ts      # KYC checks, list wallets, etc. (in progress)
│   │   └── transfer.ts    # Sending & withdrawing USDC, deposit flow, etc. (in progress)
│   ├── services/
│   │   └── copperxApi.ts  # CopperX API calls (request OTP, verify OTP, deposit, etc.)
│   ├── bot.ts             # Main entry: sets up the bot, session, commands
│   ├── types.ts           # Type definitions for session & context
├── .env                   # Env variables (BOT_TOKEN, etc.)
├── package.json
├── tsconfig.json
├── readme.md              # This documentation
└── ... (node_modules, etc.)`
```
* * * * *

4\. Setup Instructions
----------------------

### A) Installation

1.  **Clone** or download this repository.

2.  **Install** dependencies:

    ```bash
    npm install
     ```

### B) Environment Variables

Create a `.env` file at the root with:

```bash


BOT_TOKEN=<YOUR_TELEGRAM_BOT_TOKEN_HERE>
COPPERX_API_BASE=https://income-api.copperx.io
REDIS_URL=<REDIS_URL_FROM_CLOUD_PROVIDER>
```

-   **`BOT_TOKEN`**: Your Telegram Bot token from BotFather.

-   **`COPPERX_API_BASE`**: The base URL for CopperX's API.

-   **`REDIS_URL`**: The connection string for your Redis instance.

### C) Redis for Session

-   This bot uses `@grammyjs/storage-redis` for storing user session data.

-   Ensure **Redis** is running on the same machine or reachable at `REDIS_URL`.



* * * * *

5\. Scripts
-----------

| Script | Description |
| --- | --- |
| **`npm run clean`** | Removes `dist/` and temporary build files |
| **`npm run build`** | Compiles all TypeScript (`src/`) into `dist/` |
| **`npm run start`** | Runs the compiled bot (`node dist/bot.js`) |

Example usage:

```bash
npm run clean
npm run build
npm run start
 ```

* * * * *

6\. Usage
---------

### A) Authentication Flow

1.  User types **`/login`** or taps the "Log In" button.

2.  **Bot** asks for your **email**.

3.  The bot calls **`requestEmailOtp`** in `copperxApi.ts`, sending an OTP to your email.

4.  **User** enters the OTP.

5.  The bot calls **`verifyEmailOtp`**. If successful, it sets **`ctx.session.isAuthenticated = true`** and obtains a CopperX **`accessToken`**.

6.  The user can now see the main menu to do further actions.

7.  **`/logout`** or the inline "Logout" button resets the session.

### B) Current Commands

-   **`/start`**:

    -   If logged out, shows a login button.

    -   If logged in, shows an inline menu (wallets, deposit, transfer, logout).

-   **`/help`**:

    -   If logged out, shows minimal help (login, cancel).

    -   If logged in, shows advanced commands: **`/deposit`**, **`/offramp`**, etc.

-   **`/login`**: Start email + OTP flow.

-   **`/cancel`**: Cancel any ongoing operation.

-   **`/logout`**: Ends session.

-   **`/deposit [amount] [chainId?]`**: Demonstrates ephemeral deposit flow to the CopperX API.

-   **`/offramp <invoice>`**: Single-step bank off-ramp (WIP).

-   **`/sendEmail <email> <amount>`**: Email-based USDC transfer (WIP).

-   **`/withdrawWallet <addr> <amount>`**: Withdraw to external wallet.

**Inline** versions exist for some commands via the "Transfer" button.

* * * * *

7\. Work in Progress
---------------

-   **Implement** multi-step flows for off-ramp bank accounts (`/api/accounts`).

-   **Notifications** for deposit events (via Pusher or polling).

-   **Production** deployment guide (e.g. Docker setup, Heroku/Render instructions).


* * * * *

8\. Credits and References
--------------------------

-   [**grammY** documentation](https://grammy.dev/) for the Telegram Bot framework.

-   [**CopperX API** docs](https://income-api.copperx.io/api/doc) for endpoints on OTP, deposit, off-ramp, etc.

-   [**Redis** official site](https://redis.io/) for session store knowledge.