import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  DelegationCredentialIssuer,
  MemoryStatusListStorage,
  RESPONSE_PROOF_PROFILE_ENVELOPE,
  StatusList2021Manager,
  base64urlEncodeFromBytes,
  createKyaOsMiddleware,
  createKyaOsTransport,
  generateRequestProof,
  extractProofFromMeta,
  type DelegationCredential,
  type VCSigningFunction,
} from "@kya-os/mcp";
import { createKeys, roles, type Role, type SigningEvent } from "./keys";
import {
  createPublicVerifier,
  verifyReceipt,
  type Receipt,
} from "./verification";

export async function createDemo(env: NodeJS.ProcessEnv = process.env) {
  const signing: SigningEvent[] = [];
  const { mode, parties, crypto } = await createKeys(env, (event) =>
    signing.push(event),
  );
  const issuerIdentity = {
    getDid: () => parties.issuer.did,
    getKeyId: () => parties.issuer.kid,
    getPrivateKey: () => "turnkey:issuer",
  };
  const signCredential: VCSigningFunction = async (canonical, _did, kid) => ({
    type: "Ed25519Signature2020",
    created: new Date().toISOString(),
    verificationMethod: kid,
    proofPurpose: "assertionMethod",
    proofValue: base64urlEncodeFromBytes(
      await crypto.sign(new TextEncoder().encode(canonical), "turnkey:issuer"),
    ),
  });
  const issuer = new DelegationCredentialIssuer(issuerIdentity, signCredential);
  const statuses = new StatusList2021Manager(
    new MemoryStatusListStorage(),
    issuerIdentity,
    signCredential,
    undefined,
    undefined,
    { statusListBaseUrl: "https://status.demo.invalid" },
  );
  const middleware = createKyaOsMiddleware(
    {
      identity: parties.server,
      autoSession: true,
      requireAtomicNonce: true,
      emitLegacyProofKey: false,
      responseProofProfile: RESPONSE_PROOF_PROFILE_ENVELOPE,
      delegation: {
        trustedRootIssuers: [parties.issuer.did],
        holderBinding: "enforce",
        maxChainLength: 1,
        verificationCache: { ttlMs: 0 },
        statusListResolver: {
          checkStatus: (status) => statuses.checkStatus(status),
        },
      },
    },
    crypto,
  );
  const server = new Server(
    { name: "turnkey-kya-os-demo", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  let executions = 0;
  const handlers = {
    get_report: middleware.wrapWithDelegation(
      "get_report",
      { scopeId: "reports:read", consentUrl: "http://localhost:3017" },
      middleware.wrapWithProof("get_report", async () => {
        executions++;
        return {
          content: [
            { type: "text", text: "Demo report: all systems healthy." },
          ],
        };
      }),
    ),
    delete_report: middleware.wrapWithDelegation(
      "delete_report",
      { scopeId: "reports:delete", consentUrl: "http://localhost:3017" },
      middleware.wrapWithProof("delete_report", async () => {
        executions++;
        return { content: [{ type: "text", text: "Demo report deleted." }] };
      }),
    ),
  };
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      middleware.kyaOsTool,
      ...Object.keys(handlers).map((name) => ({
        name,
        inputSchema: { type: "object" as const, properties: {} },
      })),
    ],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "_kyaos")
      return middleware.handleKyaOs(request.params.arguments ?? {});
    const name = request.params.name;
    if (name !== "get_report" && name !== "delete_report")
      throw new Error("Unknown demo tool.");
    return handlers[name](request.params.arguments ?? {});
  });
  const client = new Client({ name: "turnkey-demo-agent", version: "0.1.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(createKyaOsTransport(serverTransport, middleware));
  await client.connect(clientTransport);

  let delegation: DelegationCredential | undefined;
  let revoked = false;
  let lastReceipt: Receipt | undefined;
  let lastRequestArgs: Record<string, unknown> | undefined;
  let lastTool: "get_report" | "delete_report" = "get_report";
  const verifier = createPublicVerifier();

  function state() {
    return {
      mode,
      identities: Object.fromEntries(
        roles.map((role) => [
          role,
          { did: parties[role].did, kid: parties[role].kid },
        ]),
      ),
      delegation: delegation ?? null,
      revoked,
      executions,
      signing: [...signing],
      receipt: lastReceipt ?? null,
    };
  }

  async function approve() {
    if (delegation)
      throw new Error("Restart the demo to issue a new delegation.");
    const status = await statuses.allocateStatusEntry("revocation");
    delegation = await issuer.createAndIssueDelegation(
      {
        id: `urn:uuid:${randomUUID()}`,
        issuerDid: parties.issuer.did,
        subjectDid: parties.agent.did,
        controller: parties.issuer.did,
        constraints: {
          scopes: ["reports:read"],
          audience: parties.server.did,
          notAfter: Date.now() + 10 * 60_000,
        },
      },
      {
        credentialStatus: status,
        expirationDate: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
    );
    return delegation;
  }

  async function call(
    tool: "get_report" | "delete_report" = "get_report",
    options: {
      holder?: Role;
      replay?: boolean;
      credential?: DelegationCredential;
    } = {},
  ) {
    if (options.replay) {
      if (!lastRequestArgs) throw new Error("Call a tool before replaying it.");
      tool = lastTool;
    }
    const holder = options.holder ?? "agent";
    const args =
      options.replay && lastRequestArgs
        ? lastRequestArgs
        : {
            _kyaos_proof: await generateRequestProof({
              identity: parties[holder],
              crypto,
              toolName: tool,
              args: {},
              audience: parties.server.did,
            }),
            ...((options.credential ?? delegation)
              ? { _kyaos_delegation: options.credential ?? delegation }
              : {}),
          };
    const response = await client.callTool({ name: tool, arguments: args });
    const receipt: Receipt = {
      request: {
        method: "tools/call",
        params: { name: tool, arguments: args },
      },
      response: response as Receipt["response"],
    };
    const proof = extractProofFromMeta(receipt.response._meta ?? {});
    const verification = await verifyReceipt(
      receipt,
      parties.server.did,
      verifier,
    );
    lastReceipt = receipt;
    lastRequestArgs = args;
    lastTool = tool;
    const outcome = proof.success
      ? (proof.proof.meta.outcome ??
        (receipt.response.isError === true ? "denied" : "allowed"))
      : undefined;
    return { receipt, verification, outcome };
  }

  async function revoke() {
    if (!delegation?.credentialStatus)
      throw new Error("Approve a delegation first.");
    await statuses.updateStatus(delegation.credentialStatus, true);
    revoked = true;
  }

  return {
    state,
    approve,
    call,
    revoke,
    async close() {
      await client.close();
      await server.close();
      await middleware.sessionManager.clearSessions();
    },
  };
}

export type Demo = Awaited<ReturnType<typeof createDemo>>;
