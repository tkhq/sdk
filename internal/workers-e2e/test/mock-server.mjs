// Local stand-in for the Turnkey API. It records every request and checks
// the X-Stamp header: the stamp must carry the test public key, and its
// ECDSA P-256 / SHA-256 signature must verify over the raw request body.
//
// Paths:
//   /public/v1/...                  normal API; 401 if the stamp is invalid
//   /redirect/public/v1/...         307 to /redirect-target/... (same path)
//   /redirect-target/public/v1/...  must never receive a request
import { createServer } from "node:http";
import { createPublicKey, verify } from "node:crypto";

export const REDIRECT_PREFIX = "/redirect";
export const REDIRECT_TARGET_PREFIX = "/redirect-target";

function publicKeyFromUncompressed(hex) {
  const raw = Buffer.from(hex, "hex");
  return createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: raw.subarray(1, 33).toString("base64url"),
      y: raw.subarray(33).toString("base64url"),
    },
    format: "jwk",
  });
}

function checkStamp(header, body, apiPublicKey, verifyKey) {
  try {
    const stamp = JSON.parse(Buffer.from(header, "base64url").toString());
    return (
      stamp.publicKey === apiPublicKey &&
      verify(
        "sha256",
        Buffer.from(body),
        { key: verifyKey, dsaEncoding: "der" },
        Buffer.from(stamp.signature, "hex"),
      )
    );
  } catch {
    return false;
  }
}

function apiResponse(path) {
  if (path.endsWith("/query/whoami")) {
    return {
      organizationId: "org-mock",
      organizationName: "mock",
      userId: "user-mock",
      username: "workers-e2e",
    };
  }
  if (path.endsWith("/query/list_secrets")) {
    return {
      secrets: [
        {
          secretId: "sec-1",
          name: "demo",
          staticProperties: [],
          createdAt: { seconds: "1", nanos: "0" },
        },
      ],
    };
  }
  if (path.endsWith("/submit/export_secrets")) {
    return {
      activity: {
        id: "act-mock",
        fingerprint: "sha256:mock",
        status: "ACTIVITY_STATUS_CONSENSUS_NEEDED",
        result: null,
      },
    };
  }
  return null;
}

/**
 * Starts the mock on a random local port.
 * @param {{ apiPublicKey: string, publicKeyUncompressed: string }} key
 */
export async function startMockServer(key) {
  const verifyKey = publicKeyFromUncompressed(key.publicKeyUncompressed);
  /** @type {{ path: string, stampValid: boolean }[]} */
  const requests = [];

  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const path = new URL(req.url, "http://mock").pathname;
      const stampValid = checkStamp(
        req.headers["x-stamp"],
        body,
        key.apiPublicKey,
        verifyKey,
      );
      requests.push({ path, stampValid });
      res.setHeader("content-type", "application/json");

      if (path.startsWith(REDIRECT_TARGET_PREFIX + "/")) {
        // Reached only if a client followed the redirect. Answer as if all
        // is well, so a client that follows redirects "succeeds" and the
        // test must catch it through the request log.
        res.end(JSON.stringify(apiResponse(path) ?? {}));
        return;
      }
      if (path.startsWith(REDIRECT_PREFIX + "/")) {
        const rest = path.slice(REDIRECT_PREFIX.length);
        res.statusCode = 307;
        res.setHeader("location", REDIRECT_TARGET_PREFIX + rest);
        res.end();
        return;
      }
      if (!stampValid) {
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            code: 16,
            message: "mock: invalid stamp",
            details: [],
          }),
        );
        return;
      }
      const response = apiResponse(path);
      if (!response) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            code: 5,
            message: "mock: unknown path",
            details: [],
          }),
        );
        return;
      }
      res.end(JSON.stringify(response));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
