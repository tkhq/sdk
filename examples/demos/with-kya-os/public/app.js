const buttons = [...document.querySelectorAll("button[data-action]")];
const activity = document.querySelector("#activity");
let latest;

function render(state) {
  latest = state;
  document.querySelector("#mode").textContent =
    state.mode === "turnkey" ? "Turnkey signing" : "Local signing";
  const grant = document.querySelector("#grant");
  grant.textContent = state.revoked
    ? "Revoked"
    : state.delegation
      ? "reports:read approved"
      : "No delegation";
  grant.className = `badge ${state.revoked ? "revoked" : state.delegation ? "active" : ""}`;
  document.querySelector("#executions").textContent = state.executions;
  document.querySelector("#signatures").textContent = state.signing.length;
  document.querySelector("#approve").disabled = Boolean(state.delegation);
  document.querySelector("#revoke").disabled =
    !state.delegation || state.revoked;
  document.querySelector("#verify").disabled = !state.receipt;
  document.querySelector('[data-action="replay"]').disabled = !state.receipt;
  document.querySelector("#proof").textContent = state.receipt
    ? JSON.stringify(state.receipt.response, null, 2)
    : "No response yet.";
  document.querySelector("#download").hidden = !state.receipt;
  const identities = document.querySelector("#identities");
  identities.replaceChildren();
  for (const [role, identity] of Object.entries(state.identities)) {
    const card = document.createElement("article");
    const title = document.createElement("h3");
    title.textContent = role === "issuer" ? "Human / delegation issuer" : role;
    const did = document.createElement("code");
    did.textContent = identity.did;
    card.append(title, did);
    identities.append(card);
  }
  document.querySelector("#backend-note").textContent =
    state.mode === "turnkey"
      ? "Live mode signs through the configured Turnkey keys. API credentials stay on this server."
      : "Local mode uses disposable, non-extractable keys in this process. No Turnkey API calls are made.";
}

function log(text, kind = "") {
  activity.querySelector(".empty")?.remove();
  const row = document.createElement("p");
  row.className = kind;
  const time = document.createElement("time");
  time.textContent = new Date().toLocaleTimeString();
  row.append(time, document.createTextNode(text));
  activity.append(row);
  activity.scrollTop = activity.scrollHeight;
}

for (const button of buttons) {
  button.addEventListener("click", async () => {
    buttons.forEach((item) => (item.disabled = true));
    button.setAttribute("aria-busy", "true");
    try {
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: button.dataset.action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      render(payload.state);
      const result = payload.result;
      if (result.outcome) {
        const allowed = result.outcome === "allowed";
        log(
          `${allowed ? "Tool executed" : "Tool did not execute"} · ${result.outcome} · server proof ${result.verification.valid ? "verified" : "FAILED"}`,
          result.verification.valid ? (allowed ? "good" : "") : "error",
        );
      } else if (typeof result.valid === "boolean") {
        log(
          result.valid
            ? result.bindsResponse
              ? "Verified the server identity, signature, and request/result binding using public keys only."
              : "Verified the signed denial and its request binding. Denial proofs do not cover the response body."
            : `Verification failed: ${result.reason}`,
          result.valid ? "good" : "error",
        );
      } else {
        log(result.message, "good");
      }
    } catch (error) {
      log(error instanceof Error ? error.message : "Action failed.", "error");
    } finally {
      button.removeAttribute("aria-busy");
      buttons.forEach((item) => (item.disabled = false));
      if (latest) render(latest);
    }
  });
}

fetch("/api/state")
  .then((response) => response.json())
  .then(render)
  .catch(() => log("Could not connect to the demo server.", "error"));
