import { describe, expect, it, jest } from "@jest/globals";
import { OAuthProviders } from "@turnkey/sdk-types";
import { openOAuthPopupAndNavigate } from "../utils/oauth/url";

function createMockWindow() {
  return {
    location: { href: "" },
    closed: false,
    close: jest.fn(),
  } as unknown as Window;
}

describe("openOAuthPopupAndNavigate", () => {
  it("opens the popup before running buildAuthUrl, even when buildAuthUrl resolves on a later tick", async () => {
    const callOrder: string[] = [];
    const mockWindow = createMockWindow();
    const openPopup = jest.fn(() => {
      callOrder.push("open");
      return mockWindow;
    });
    const buildAuthUrl = jest.fn(async () => {
      // Resolve past a real setTimeout tick, not just a microtask, to prove
      // the popup was already open before any async work started - not only
      // in the fast-resolving case a manual repro happens to hit.
      await new Promise((resolve) => setTimeout(resolve, 0));
      callOrder.push("build");
      return "https://example.com/oauth";
    });

    const result = await openOAuthPopupAndNavigate(
      OAuthProviders.GOOGLE,
      buildAuthUrl,
      openPopup,
    );

    expect(callOrder).toEqual(["open", "build"]);
    expect(result).toBe(mockWindow);
    expect(mockWindow.location.href).toBe("https://example.com/oauth");
  });

  it("throws the standard error and never calls buildAuthUrl when the popup is blocked", async () => {
    const openPopup = jest.fn(() => null);
    const buildAuthUrl = jest.fn(async () => "https://example.com/oauth");

    await expect(
      openOAuthPopupAndNavigate(OAuthProviders.GOOGLE, buildAuthUrl, openPopup),
    ).rejects.toThrow("Failed to open Google login window.");
    expect(buildAuthUrl).not.toHaveBeenCalled();
  });

  it("closes the popup instead of leaving a stray blank window when buildAuthUrl rejects", async () => {
    const mockWindow = createMockWindow();
    const openPopup = jest.fn(() => mockWindow);
    const buildAuthUrl = jest.fn(async () => {
      throw new Error("failed to create api key pair");
    });

    await expect(
      openOAuthPopupAndNavigate(OAuthProviders.GOOGLE, buildAuthUrl, openPopup),
    ).rejects.toThrow("failed to create api key pair");
    expect(mockWindow.close).toHaveBeenCalledTimes(1);
  });
});
