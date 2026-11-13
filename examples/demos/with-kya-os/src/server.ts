import "dotenv/config";
import { createServer, type IncomingMessage } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createDemo, type Demo } from "./scenario.js";
import { verifyReceipt } from "./verification.js";

const assets: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
};

async function readAction(request: IncomingMessage) {
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
    if (Buffer.byteLength(body) > 1024) throw new Error("Request too large.");
  }
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== "object" || !("action" in parsed))
    throw new Error("Choose a demo action.");
  return parsed.action;
}

export async function startWebServer(demo: Demo, port = 3017) {
  let busy = false;
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    const json = (status: number, value: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
    };
    const address = server.address();
    if (!address || typeof address === "string")
      return json(503, { error: "Starting." });
    const host = request.headers.host;
    if (
      host !== `127.0.0.1:${address.port}` &&
      host !== `localhost:${address.port}`
    )
      return json(403, { error: "Use the local demo URL." });
    const pathname = request.url;
    if (request.method === "GET" && pathname === "/api/state")
      return json(200, demo.state());
    if (request.method === "GET" && pathname === "/api/receipt") {
      const receipt = demo.state().receipt;
      return receipt
        ? json(200, receipt)
        : json(404, { error: "Call a tool first." });
    }
    if (request.method === "GET" && pathname && assets[pathname]) {
      const asset = assets[pathname]!;
      const contents = await readFile(
        new URL(`../public/${asset.file}`, import.meta.url),
      );
      response.writeHead(200, { "Content-Type": asset.type });
      response.end(contents);
      return;
    }
    if (request.method !== "POST" || pathname !== "/api/action")
      return json(404, { error: "Not found." });
    if (
      request.headers["content-type"] !== "application/json" ||
      (request.headers.origin !== undefined &&
        request.headers.origin !== `http://${host}`)
    )
      return json(403, { error: "Use the demo page to authorize actions." });
    if (busy) return json(409, { error: "An action is already running." });
    busy = true;
    try {
      const action = await readAction(request);
      let result: unknown;
      switch (action) {
        case "call":
          result = await demo.call();
          break;
        case "approve":
          await demo.approve();
          result = {
            message: "Issued reports:read delegation for ten minutes.",
          };
          break;
        case "revoke":
          await demo.revoke();
          result = {
            message:
              "Published a revoked status. The original credential is unchanged.",
          };
          break;
        case "scope":
          result = await demo.call("delete_report");
          break;
        case "replay":
          result = await demo.call("get_report", { replay: true });
          break;
        case "verify": {
          const state = demo.state();
          if (!state.receipt) throw new Error("Call a tool first.");
          result = await verifyReceipt(
            state.receipt,
            state.identities.server!.did,
          );
          break;
        }
        default:
          return json(400, { error: "Unknown demo action." });
      }
      json(200, { result, state: demo.state() });
    } catch {
      // Upstream errors can contain request credentials. Keep the UI error bounded.
      json(400, {
        error: "Action failed. Check the configuration and current demo step.",
      });
    } finally {
      busy = false;
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No local server address.");
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await demo.close();
    },
  };
}

async function main() {
  const port = Number(process.env.PORT ?? "3017");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be between 1 and 65535.");
  const demo = await createDemo();
  const web = await startWebServer(demo, port);
  console.log(`KYA-OS demo (${demo.state().mode} signing): ${web.url}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => void web.close().then(() => process.exit(0)));
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      "Could not start the demo. Check .env and the configured keys.",
    );
    process.exitCode = 1;
  });
