import { webcrypto } from "node:crypto";
import {
  NodeCryptoProvider,
  generateDidKeyFromBase64,
  type KyaOsIdentityConfig,
} from "@kya-os/mcp";
import {
  Turnkey,
  createTurnkeyBotSigner,
  ed25519PublicKeyToJwk,
  type TurnkeyBotSigner,
  type TurnkeyBotSigningClient,
} from "@turnkey/sdk-server";

export const roles = ["issuer", "server", "agent"] as const;
export type Role = (typeof roles)[number];
export type Mode = "local" | "turnkey";
export type Party = KyaOsIdentityConfig & { signer: TurnkeyBotSigner };
export type SigningEvent = { role: Role; activityId: string };

export class DemoCryptoProvider extends NodeCryptoProvider {
  constructor(private readonly parties: Record<Role, Party>) {
    super();
  }

  override async sign(data: Uint8Array, handle: string): Promise<Uint8Array> {
    const role = roles.find((name) => handle === `turnkey:${name}`);
    if (!role) throw new Error("Unknown demo signing handle.");
    return this.parties[role].signer.sign(data);
  }

  override async generateKeyPair(): Promise<{
    privateKey: string;
    publicKey: string;
  }> {
    throw new Error("The demo uses explicitly configured signing keys.");
  }
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Set ${name} for Turnkey mode.`);
  return value;
}

export async function createKeys(
  env: NodeJS.ProcessEnv,
  onSign: (event: SigningEvent) => void = () => {},
) {
  const mode = env.DEMO_MODE ?? "local";
  if (mode !== "local" && mode !== "turnkey")
    throw new Error("DEMO_MODE must be local or turnkey.");

  let client: TurnkeyBotSigningClient;
  let organizationId = "local-demo";
  const publicKeys = new Map<Role, string>();
  const references = new Map<Role, string>();

  if (mode === "turnkey") {
    organizationId = required(env, "TURNKEY_ORGANIZATION_ID");
    const sdk = new Turnkey({
      apiBaseUrl: env.TURNKEY_BASE_URL ?? "https://api.turnkey.com",
      apiPublicKey: required(env, "TURNKEY_API_PUBLIC_KEY"),
      apiPrivateKey: required(env, "TURNKEY_API_PRIVATE_KEY"),
      defaultOrganizationId: organizationId,
    }).apiClient();
    client = sdk;
    for (const role of roles) {
      const privateKeyId = required(
        env,
        `TURNKEY_${role.toUpperCase()}_KEY_ID`,
      );
      try {
        const result = await sdk.getPrivateKey({
          organizationId,
          privateKeyId,
        });
        if (result.privateKey.curve !== "CURVE_ED25519")
          throw new Error("Wrong key curve.");
        publicKeys.set(role, result.privateKey.publicKey);
        references.set(role, privateKeyId);
      } catch {
        throw new Error(
          `Could not load the ${role} Ed25519 key. Check its ID, API credentials, and permissions.`,
        );
      }
    }
    if (new Set(references.values()).size !== roles.length)
      throw new Error("Use three distinct Turnkey Ed25519 test keys.");
  } else {
    const keys = new Map<string, webcrypto.CryptoKey>();
    for (const role of roles) {
      const pair = (await webcrypto.subtle.generateKey("Ed25519", false, [
        "sign",
        "verify",
      ])) as webcrypto.CryptoKeyPair;
      keys.set(role, pair.privateKey);
      references.set(role, role);
      publicKeys.set(
        role,
        Buffer.from(
          await webcrypto.subtle.exportKey("raw", pair.publicKey),
        ).toString("hex"),
      );
    }
    let sequence = 0;
    client = {
      async signRawPayload(input) {
        const privateKey = keys.get(input.signWith);
        if (!privateKey) throw new Error("Unknown local demo key.");
        const signature = Buffer.from(
          await webcrypto.subtle.sign(
            "Ed25519",
            privateKey,
            Buffer.from(input.payload, "hex"),
          ),
        ).toString("hex");
        return {
          r: signature.slice(0, 64),
          s: signature.slice(64),
          activity: {
            id: `local-${++sequence}`,
            status: "ACTIVITY_STATUS_COMPLETED",
          },
        };
      },
    };
  }

  const entries = await Promise.all(
    roles.map(async (role): Promise<[Role, Party]> => {
      const hex = publicKeys.get(role)!;
      const publicKey = await webcrypto.subtle.importKey(
        "jwk",
        ed25519PublicKeyToJwk(hex),
        "Ed25519",
        true,
        ["verify"],
      );
      const publicKeyBase64 = Buffer.from(hex, "hex").toString("base64");
      const did = generateDidKeyFromBase64(publicKeyBase64);
      const signer = createTurnkeyBotSigner({
        client,
        organizationId,
        signWith: references.get(role)!,
        publicKey,
        onActivity: (activityId) => onSign({ role, activityId }),
      });
      return [
        role,
        {
          did,
          kid: `${did}#${did.slice("did:key:".length)}`,
          publicKey: publicKeyBase64,
          // The pinned KYA-OS proof hook accepts the checked SDK signer directly.
          privateKey: signer,
          signer,
        },
      ];
    }),
  );
  const parties = Object.fromEntries(entries) as Record<Role, Party>;
  return { mode, parties, crypto: new DemoCryptoProvider(parties) };
}
