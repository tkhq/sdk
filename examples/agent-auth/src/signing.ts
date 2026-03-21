/**
 * Signing helpers example for @turnkey/agent-auth
 *
 * Demonstrates:
 * - signJwt: Mint ES256 JWTs for API authentication
 * - signSshCommit: Sign git commits with Ed25519 (SSHSIG format)
 * - signMessage: General-purpose message signing
 *
 * Usage:
 *   cp .env.local.example .env.local
 *   # Fill in your Turnkey credentials
 *   pnpm run signing
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { Turnkey } from "@turnkey/sdk-server";
import {
  createAgentSession,
  deleteAgentSession,
  presets,
  signJwt,
  signSshCommit,
  signMessage,
} from "@turnkey/agent-auth";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const apiBaseUrl = process.env.BASE_URL!;

  const turnkey = new Turnkey({
    apiBaseUrl,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  // 1. Provision an agent with JWT signing (P256) and git signing (Ed25519)
  console.log("Provisioning agent...");
  const session = await createAgentSession(
    turnkey.apiClient(),
    {
      organizationId,
      agentName: `signing-example-${Date.now()}`,
      expirationSeconds: 600,
      accounts: [presets.jwtSigning(), presets.gitSigning()],
    },
    { apiBaseUrl },
  );
  console.log(`  Agent provisioned: ${session.subOrganizationId}\n`);

  // Create the agent's authenticated client
  const agentTurnkey = new Turnkey({
    apiBaseUrl,
    apiPublicKey: session.apiKey.publicKey,
    apiPrivateKey: session.apiKey.privateKey,
    defaultOrganizationId: session.subOrganizationId,
  });
  const agentClient = agentTurnkey.apiClient();

  // 2. signJwt: Mint an ES256 JWT
  //    Use case: authenticate to MCP servers, internal APIs, Pierre
  console.log("--- signJwt ---");
  const jwt = await signJwt(agentClient, {
    organizationId: session.subOrganizationId,
    signingKey: session.accounts[0]!.publicKey,
    payload: {
      iss: session.subOrganizationId,
      sub: session.agentUserId,
      aud: "https://my-api.example.com",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      scope: "read write",
    },
  });
  console.log(`JWT: ${jwt.substring(0, 60)}...`);

  // Decode and display the JWT parts
  const [headerB64, payloadB64] = jwt.split(".");
  const header = JSON.parse(
    atob(headerB64!.replace(/-/g, "+").replace(/_/g, "/")),
  );
  const payload = JSON.parse(
    atob(payloadB64!.replace(/-/g, "+").replace(/_/g, "/")),
  );
  console.log(`Header: ${JSON.stringify(header)}`);
  console.log(`Payload: ${JSON.stringify(payload)}`);
  console.log(`Expires: ${new Date(payload.exp * 1000).toISOString()}\n`);

  // 3. signSshCommit: Sign a git commit with Ed25519
  //    Use case: git commit signing with "Verified" badges
  console.log("--- signSshCommit ---");
  const fakeCommit = Buffer.from(
    "tree 4b825dc642cb6eb9a060e54bf899d8e33f4daa0a\n" +
      "author Agent <agent@example.com> 1700000000 +0000\n" +
      "committer Agent <agent@example.com> 1700000000 +0000\n\n" +
      "Initial commit\n",
  ).toString("hex");

  const sshSig = await signSshCommit(agentClient, {
    organizationId: session.subOrganizationId,
    signingKey: session.accounts[1]!.publicKey,
    commitBuffer: fakeCommit,
    publicKey: session.accounts[1]!.publicKey,
  });
  console.log("SSH Signature:");
  console.log(sshSig.split("\n").slice(0, 3).join("\n"));
  console.log("  ...");
  console.log(sshSig.split("\n").slice(-2).join("\n"));

  // 4. signMessage: General-purpose signing
  //    Use case: webhook signatures, challenge-response, custom protocols
  console.log("\n--- signMessage ---");
  const messageHex =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const sig = await signMessage(agentClient, {
    organizationId: session.subOrganizationId,
    signingKey: session.accounts[0]!.publicKey,
    message: messageHex,
  });
  console.log(`r: ${sig.r.substring(0, 20)}...`);
  console.log(`s: ${sig.s.substring(0, 20)}...`);
  console.log(`v: ${sig.v}`);

  // 5. Clean up
  console.log("\nCleaning up...");
  await deleteAgentSession(
    {
      subOrganizationId: session.subOrganizationId,
      adminApiKey: session.adminApiKey,
    },
    { apiBaseUrl },
  );
  console.log("Done.");
}

main().catch(console.error);
