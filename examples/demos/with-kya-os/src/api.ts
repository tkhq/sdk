import type { Demo } from "./scenario";
import { verifyReceipt } from "./verification";

export type DemoState = ReturnType<Demo["state"]>;
export type DemoAction =
  | "call"
  | "approve"
  | "revoke"
  | "scope"
  | "replay"
  | "verify";
export type DemoResult =
  | Awaited<ReturnType<Demo["call"]>>
  | Awaited<ReturnType<typeof verifyReceipt>>
  | { message: string };
export type ActionResponse = { result: DemoResult; state: DemoState };

function json(status: number, value: unknown) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function localOrigin(request: Request) {
  // Next.js may normalize request.url to localhost. Bind browser authority to
  // the actual Host header, which still must name a loopback address and port.
  const host = request.headers.get("host");
  if (!host || !/^(127\.0\.0\.1|localhost):[1-9]\d{0,4}$/.test(host)) return;
  if (Number(host.split(":")[1]) > 65535) return;
  return `http://${host}`;
}

async function readAction(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Choose a demo action.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        throw new Error("Request too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks).toString();
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== "object" || !("action" in parsed))
    throw new Error("Choose a demo action.");
  return parsed.action;
}

export function createDemoApi(getDemo: () => Promise<Demo>) {
  let busy = false;
  return {
    async state(request: Request) {
      if (!localOrigin(request))
        return json(403, { error: "Use the local demo URL." });
      try {
        return json(200, (await getDemo()).state());
      } catch {
        return json(503, { error: "Check the configured demo keys." });
      }
    },
    async receipt(request: Request) {
      if (!localOrigin(request))
        return json(403, { error: "Use the local demo URL." });
      try {
        const receipt = (await getDemo()).state().receipt;
        return receipt
          ? json(200, receipt)
          : json(404, { error: "Call a tool first." });
      } catch {
        return json(503, { error: "Check the configured demo keys." });
      }
    },
    async action(request: Request) {
      if (
        !localOrigin(request) ||
        request.headers.get("content-type") !== "application/json" ||
        request.headers.get("origin") !== localOrigin(request)
      )
        return json(403, { error: "Use the demo page to authorize actions." });
      if (busy) return json(409, { error: "An action is already running." });
      busy = true;
      try {
        const action = await readAction(request);
        if (
          typeof action !== "string" ||
          !["call", "approve", "revoke", "scope", "replay", "verify"].includes(
            action,
          )
        )
          return json(400, { error: "Unknown demo action." });
        const demo = await getDemo();
        let result: DemoResult;
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
        return json(200, {
          result,
          state: demo.state(),
        } satisfies ActionResponse);
      } catch {
        // Upstream errors may include credentials. Never send them to the browser.
        return json(400, {
          error:
            "Action failed. Check the configuration and current demo step.",
        });
      } finally {
        busy = false;
      }
    },
  };
}
