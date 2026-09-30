// Runs src/worker.ts in workerd (through wrangler) and checks each route
// against the local mock API.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { generateP256KeyPair } from "@turnkey/crypto";
import { unstable_startWorker } from "wrangler";
import {
  REDIRECT_PREFIX,
  REDIRECT_TARGET_PREFIX,
  startMockServer,
} from "./mock-server.mjs";

const configPath = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));

// A throwaway key for this run only. It is not a Turnkey credential.
const keyPair = generateP256KeyPair();
const key = {
  apiPublicKey: keyPair.publicKey,
  apiPrivateKey: keyPair.privateKey,
  publicKeyUncompressed: keyPair.publicKeyUncompressed,
};

// Starts the Worker and waits until it answers a request. `ready` can
// resolve even when the Worker throws at startup (for example "process is
// not defined"); wrangler reports that as an "error" event, and requests then
// hang. So race a first request against that event and a timeout.
async function startWorker() {
  const started = await unstable_startWorker({
    config: configPath,
    dev: {
      server: { hostname: "127.0.0.1", port: 0 },
      inspector: false,
      logLevel: "error",
    },
  });
  let timer;
  try {
    const url = await Promise.race([
      (async () => {
        await started.ready;
        const url = await started.url;
        await (await started.fetch(new URL("/health", url))).arrayBuffer();
        return url;
      })(),
      new Promise((_, reject) => {
        started.raw.once("error", (event) => {
          const cause = event?.cause?.message ?? event?.reason ?? event;
          reject(new Error(`Worker failed to start: ${cause}`));
        });
        timer = setTimeout(
          () => reject(new Error(`Worker not ready after 60s`)),
          60_000,
        );
      }),
    ]);
    return { worker: started, url };
  } catch (error) {
    // Stop workerd now, or its handles keep the test process alive.
    await started.dispose().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const mock = await startMockServer(key);
let worker;
let workerUrl;
let startupError;
try {
  ({ worker, url: workerUrl } = await startWorker());
} catch (error) {
  startupError = error;
}

after(async () => {
  await worker?.dispose();
  await mock.close();
});

// Without nodejs_compat, this is where the sdk-server import crash shows up.
test(`Worker starts`, () => {
  if (startupError) throw startupError;
});

const skip = startupError ? "Worker did not start" : false;

async function callWorker(path, input) {
  const url = new URL(path, workerUrl);
  const response = await worker.fetch(
    url,
    input ? { method: "POST", body: JSON.stringify(input) } : { method: "GET" },
  );
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}

function stepsByName(steps) {
  return Object.fromEntries(steps.map((s) => [s.step, s]));
}

function assertOk(step) {
  assert.ok(step, "step missing");
  assert.equal(step.ok, true, `${step.step}: ${JSON.stringify(step.error)}`);
  return step.result;
}

const input = () => ({ ...key, base: mock.url });

test(`sdk-server calls are stamped and verified`, { skip }, async () => {
  const before = mock.requests.length;
  const steps = stepsByName(await callWorker("/sdk-server", input()));

  assert.equal(assertOk(steps.getWhoami).organizationId, "org-mock");
  assert.equal(assertOk(steps.getSecrets)[0].secretId, "sec-1");
  assert.deepEqual(assertOk(steps.submitExportSecrets), {
    activityId: "act-mock",
    fingerprint: "sha256:mock",
    status: "ACTIVITY_STATUS_CONSENSUS_NEEDED",
  });

  const seen = mock.requests.slice(before);
  assert.deepEqual(
    seen.map((r) => r.path),
    [
      "/public/v1/query/whoami",
      "/public/v1/query/list_secrets",
      "/public/v1/submit/export_secrets",
    ],
  );
  assert.ok(
    seen.every((r) => r.stampValid),
    "mock rejected a stamp",
  );
});

test(
  `@turnkey/http TurnkeyClient uses redirect: "manual"`,
  { skip },
  async () => {
    const before = mock.requests.length;
    const [step] = await callWorker("/http", input());

    const result = assertOk(step);
    assert.equal(result.value.organizationId, "org-mock");
    assert.deepEqual(result.redirectModes, ["manual"]);

    const seen = mock.requests.slice(before);
    assert.deepEqual(
      seen.map((r) => [r.path, r.stampValid]),
      [["/public/v1/query/whoami", true]],
    );
  },
);

// Regression test for tkhq/sdk#1571. @turnkey/http 6.4.0 sent
// redirect: "error", which workerd rejects, so every call failed. Before
// that, it sent "follow", which forwards the stamped body to the redirect
// target. The client must refuse the 3xx and never contact the target.
test(`@turnkey/http TurnkeyClient refuses a redirect`, { skip }, async () => {
  const before = mock.requests.length;
  const [step] = await callWorker("/http", {
    ...input(),
    base: mock.url + REDIRECT_PREFIX,
  });

  assert.equal(step.ok, false, "call through a redirect must fail");
  assert.match(step.error.message, /redirected \(307\)/);

  const seen = mock.requests.slice(before).map((r) => r.path);
  assert.deepEqual(seen, [REDIRECT_PREFIX + "/public/v1/query/whoami"]);
  assert.ok(
    !seen.some((p) => p.startsWith(REDIRECT_TARGET_PREFIX)),
    "redirect target received a request",
  );
});

test(`WebCrypto and export bundle decryption`, { skip }, async () => {
  const steps = stepsByName(await callWorker("/crypto"));

  assert.deepEqual(assertOk(steps["AES-256-GCM seal/open"]), {
    roundTrip: true,
    tamperRejected: true,
  });
  assert.deepEqual(assertOk(steps.decryptSecretBundle), { match: true });
  assert.deepEqual(assertOk(steps.decryptExportBundle), { match: true });
});
