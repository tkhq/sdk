import { Turnkey } from "@turnkey/sdk-server";
import * as dotenv from "dotenv";
import * as path from "path";
import { hashMessage } from "viem";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {

// Initializing the Turkey client used by the Delegated account activities
// Notice the subOrganizationId created above 
const turnkeyDelegated = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.DELEGATED_API_PRIVATE_KEY!,
    apiPublicKey: process.env.DELEGATED_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.DELEGATED_SUBORG_ID!
}).apiClient();

async function signTx(raw_tx: string, label: string) {
    console.log(`\n=== ${label} ===`);
    try {
        const { signedTransaction } = await turnkeyDelegated
            .signTransaction({
                signWith: process.env.SIGN_WITH!,
                type: "TRANSACTION_TYPE_ETHEREUM",
                unsignedTransaction: raw_tx,
        });
        console.log("✅ Successfully signed transaction:");
        console.log(signedTransaction);
    }catch (err) {
        console.error("❌ Failed to sign transaction:");
        console.log((err as Error).message);
    }
    console.log("=".repeat(40));
}

//generate a raw tx https://build.tx.xyz/ from your sib-org wallet address to the RECIPIENT_ADDRESS
const valid_tx = "...";
const invalid_tx = "...";
// this activity should be allowed by the Turnkey Policy engine
await signTx (valid_tx, "Policy Tx Allow");
// this activity should be denied by the Turnkey Policy engine
await signTx (invalid_tx, "Policy Tx Deny");

// let's try a different activity like signRawPayload
// this activity should be denied by the Turnkey Policy engine
const message = "test message to be signed";
try {
    const { r, s, v } = await turnkeyDelegated.signRawPayload({
        signWith: process.env.SIGN_WITH!,
        payload: hashMessage(message),
        hashFunction: "HASH_FUNCTION_KECCAK256",
        encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
    });
    console.log(`\n=== Trying signRawPayload ===`);
    console.log("Sign raw payload response:", { r, s, v });
} catch (err) {
    console.error("❌ Failed to sign raw message:");
    console.log((err as Error).message);
}

}
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });