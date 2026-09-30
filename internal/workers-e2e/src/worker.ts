// Test Worker for the workers-e2e checks. The Node test runner (test/) starts
// this Worker in workerd with wrangler, then calls one route per check. Each
// route returns JSON; the runner asserts on it. All API calls go to the local
// mock server in test/mock-server.mjs. The API key is generated per test run.
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  decryptExportBundle,
  decryptSecretBundle,
  generateP256KeyPair,
  hpkeEncrypt,
  uncompressRawPublicKey,
} from "@turnkey/crypto";
import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha256";

const ORG = "00000000-0000-0000-0000-000000000000";

type Input = {
  base: string;
  apiPublicKey: string;
  apiPrivateKey: string;
};

type Step =
  | { step: string; ok: true; result: unknown }
  | {
      step: string;
      ok: false;
      error: { name?: string | undefined; message: string };
    };

async function step(name: string, fn: () => Promise<unknown>): Promise<Step> {
  try {
    return { step: name, ok: true, result: await fn() };
  } catch (e) {
    const err = e as Error | undefined;
    return {
      step: name,
      ok: false,
      error: { name: err?.name, message: String(err?.message ?? e) },
    };
  }
}

// Records the `redirect` option of every outgoing fetch while `fn` runs.
// Both cross-fetch (aliased by wrangler) and the generated clients look up
// globalThis.fetch at call time, so a temporary wrapper sees their calls.
async function withFetchSpy<T>(
  fn: () => Promise<T>,
): Promise<{ value: T; redirectModes: (string | undefined)[] }> {
  const original = globalThis.fetch;
  const redirectModes: (string | undefined)[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    redirectModes.push(
      init?.redirect ?? (input instanceof Request ? input.redirect : undefined),
    );
    return original(input, init);
  }) as typeof fetch;
  try {
    return { value: await fn(), redirectModes };
  } finally {
    globalThis.fetch = original;
  }
}

async function sdkServerChecks(input: Input): Promise<Step[]> {
  const client = new Turnkey({
    apiBaseUrl: input.base,
    apiPublicKey: input.apiPublicKey,
    apiPrivateKey: input.apiPrivateKey,
    defaultOrganizationId: ORG,
  }).apiClient();
  return [
    await step("getWhoami", () => client.getWhoami({ organizationId: ORG })),
    await step("getSecrets", () => client.getSecrets()),
    await step("submitExportSecrets", () => {
      const target = generateP256KeyPair();
      const proposal = client.createExportSecretsProposal({
        secrets: [{ secretId: "sec-1" }],
        targetPublicKey: target.publicKeyUncompressed,
        organizationId: ORG,
        timestampMs: String(Date.now()),
      });
      return client.submitExportSecrets(proposal);
    }),
  ];
}

function httpClient(input: Input): TurnkeyClient {
  const stamper = new ApiKeyStamper({
    apiPublicKey: input.apiPublicKey,
    apiPrivateKey: input.apiPrivateKey,
  });
  return new TurnkeyClient({ baseUrl: input.base }, stamper);
}

// The runner calls /http twice: once with the plain mock as `base`, and once
// with the mock's redirecting prefix. It checks the results.
async function httpChecks(input: Input): Promise<Step[]> {
  return [
    await step("TurnkeyClient getWhoami", () =>
      withFetchSpy(() => httpClient(input).getWhoami({ organizationId: ORG })),
    ),
  ];
}

// Builds an enclave-shaped bundle signed by a fake signer key, so the
// decrypt helpers that sdk-server uses can run with no real enclave.
function makeBundle(plaintext: Uint8Array, receiverUncompressedHex: string) {
  const signer = generateP256KeyPair();
  const enc = hpkeEncrypt({
    plainTextBuf: plaintext,
    targetKeyBuf: uint8ArrayFromHexString(receiverUncompressedHex),
  });
  const encapped = uncompressRawPublicKey(enc.slice(0, 33));
  const data = new TextEncoder().encode(
    JSON.stringify({
      organizationId: ORG,
      encappedPublic: uint8ArrayToHexString(encapped),
      ciphertext: uint8ArrayToHexString(enc.slice(33)),
    }),
  );
  const signature = p256.sign(sha256(data), signer.privateKey).toDERHex();
  return {
    signerPublicKey: signer.publicKeyUncompressed,
    bundle: JSON.stringify({
      version: "v1.0.0",
      data: uint8ArrayToHexString(data),
      dataSignature: signature,
      enclaveQuorumPublic: signer.publicKeyUncompressed,
    }),
  };
}

async function cryptoChecks(): Promise<Step[]> {
  return [
    await step("AES-256-GCM seal/open", async () => {
      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const aad = new TextEncoder().encode("kid=1;op=release");
      const plaintext = "workers-e2e plaintext";
      const sealed = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: aad },
        key,
        new TextEncoder().encode(plaintext),
      );
      const opened = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: aad },
        key,
        sealed,
      );
      let tamperRejected = false;
      try {
        await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv,
            additionalData: new TextEncoder().encode("kid=1;op=other"),
          },
          key,
          sealed,
        );
      } catch {
        tamperRejected = true;
      }
      return {
        roundTrip: new TextDecoder().decode(opened) === plaintext,
        tamperRejected,
      };
    }),
    await step("decryptSecretBundle", async () => {
      const receiver = generateP256KeyPair();
      const { bundle, signerPublicKey } = makeBundle(
        new TextEncoder().encode("workers-e2e-secret"),
        receiver.publicKeyUncompressed,
      );
      const plaintext = await decryptSecretBundle({
        secretPayload: bundle,
        embeddedPrivateKey: receiver.privateKey,
        organizationId: ORG,
        dangerouslyOverrideSignerPublicKey: signerPublicKey,
      });
      return { match: plaintext === "workers-e2e-secret" };
    }),
    await step("decryptExportBundle", async () => {
      const receiver = generateP256KeyPair();
      const raw = crypto.getRandomValues(new Uint8Array(32));
      const { bundle, signerPublicKey } = makeBundle(
        raw,
        receiver.publicKeyUncompressed,
      );
      const hex = await decryptExportBundle({
        exportBundle: bundle,
        embeddedKey: receiver.privateKey,
        organizationId: ORG,
        dangerouslyOverrideSignerPublicKey: signerPublicKey,
        keyFormat: "HEXADECIMAL",
        returnMnemonic: false,
      });
      return { match: hex === uint8ArrayToHexString(raw) };
    }),
  ];
}

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") {
      return new Response("ok");
    }
    if (pathname === "/crypto") {
      return Response.json(await cryptoChecks());
    }
    if (request.method !== "POST") {
      return new Response("not found", { status: 404 });
    }
    const input = (await request.json()) as Input;
    switch (pathname) {
      case "/sdk-server":
        return Response.json(await sdkServerChecks(input));
      case "/http":
        return Response.json(await httpChecks(input));
      default:
        return new Response("not found", { status: 404 });
    }
  },
};
