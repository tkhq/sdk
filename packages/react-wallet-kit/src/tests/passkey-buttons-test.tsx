/** @jest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "@jest/globals";
import { PasskeyButtons } from "../components/auth/Passkey";

async function render(props: { hideSignUp?: boolean }) {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <PasskeyButtons onLogin={() => {}} onSignUp={() => {}} {...props} />,
    );
  });
  return { container, root };
}

function buttonLabels(container: HTMLElement) {
  return Array.from(container.querySelectorAll("button")).map((b) =>
    b.textContent?.trim(),
  );
}

describe("PasskeyButtons", () => {
  it("renders both log in and sign up by default", async () => {
    const { container, root } = await render({});
    expect(buttonLabels(container)).toEqual([
      "Log in with passkey",
      "Sign up with passkey",
    ]);
    await act(async () => root.unmount());
  });

  it("renders only log in when hideSignUp is true", async () => {
    const { container, root } = await render({ hideSignUp: true });
    expect(buttonLabels(container)).toEqual(["Log in with passkey"]);
    await act(async () => root.unmount());
  });
});
