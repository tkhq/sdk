import { describe, expect, it } from "@jest/globals";
import { Session, SessionType } from "@turnkey/sdk-types";
import { StamperType } from "@turnkey/core";
import { resolveRefreshStamper } from "../utils/utils";

describe("resolveRefreshStamper", () => {
  const validSession: Session = {
    sessionType: SessionType.READ_WRITE,
    userId: "user123",
    organizationId: "org123",
    expiry: (Date.now() + 1000 * 60 * 60) / 1000, // 1 hour in the future
    expirationSeconds: "3600",
    token: "<token>",
    publicKey: "<publicKey>",
  };
  const expiredSession: Session = {
    sessionType: SessionType.READ_WRITE,
    userId: "user123",
    organizationId: "org123",
    expiry: (Date.now() - 1000 * 60 * 60) / 1000, // 1 hour in the past
    expirationSeconds: "3600",
    token: "<token>",
    publicKey: "<publicKey>",
  };

  it("uses the session key when the session is valid", () => {
    expect(resolveRefreshStamper(validSession, StamperType.Passkey)).toBe(
      StamperType.ApiKey,
    );
  });

  it("uses the session key when no stamper was passed", () => {
    expect(resolveRefreshStamper(validSession)).toBe(StamperType.ApiKey);
  });

  it("falls back to the caller's stamper when the session is expired", () => {
    expect(resolveRefreshStamper(expiredSession, StamperType.Passkey)).toBe(
      StamperType.Passkey,
    );
  });

  it("falls back to the caller's stamper when there is no session", () => {
    expect(resolveRefreshStamper(undefined, StamperType.Passkey)).toBe(
      StamperType.Passkey,
    );
  });

  it("returns undefined without a session or a caller stamper", () => {
    expect(resolveRefreshStamper(undefined)).toBeUndefined();
  });
});
