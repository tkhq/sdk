"use client";

import {
  StamperType,
  type MfaContext,
  type TurnkeyClientMethods,
  type TurnkeySDKClientBase,
} from "@turnkey/react-wallet-kit";
import type { v1MfaStatus } from "@turnkey/sdk-types";

export type MfaProgress = "idle" | "requested" | "approved";

/**
 * Whether a passkey is still outstanding. Reading `mfaStatuses` rather than assuming is what
 * keeps a handler working when the policies change.
 */
export function passkeyStillRequired(mfaStatuses: v1MfaStatus[]): boolean {
  return mfaStatuses.some((status) => {
    if (status.satisfied) return false;

    const satisfiedTypes = new Set(
      status.satisfiedMethods.map((method) => method.type),
    );

    // A requirement that is unmet, and that a passkey would meet.
    return status.requiredMethods.some(
      (requirement) =>
        !requirement.any.some((method) => satisfiedTypes.has(method.type)) &&
        requirement.any.some(
          (method) => method.type === "AUTHENTICATION_TYPE_PASSKEY",
        ),
    );
  });
}

/** Human-readable list of what MFA is still waiting on, for notices and error messages. */
export function describeOutstandingMethods(mfaStatuses: v1MfaStatus[]): string {
  const outstanding = mfaStatuses
    .filter((status) => !status.satisfied)
    .flatMap((status) => {
      const satisfiedTypes = new Set(
        status.satisfiedMethods.map((method) => method.type),
      );

      return status.requiredMethods
        .filter(
          (requirement) =>
            !requirement.any.some((method) => satisfiedTypes.has(method.type)),
        )
        .map((requirement) =>
          requirement.any
            .map((method) => method.type.replace("AUTHENTICATION_TYPE_", ""))
            .join(" or "),
        );
    });

  return outstanding.length > 0 ? outstanding.join(" and ") : "nothing";
}

/**
 * Builds an MFA handler that approves the pending activity with a passkey.
 *
 * Registering a handler is not optional. With none registered, an activity that needs MFA is
 * handed back to the caller untouched (status AUTHENTICATORS_NEEDED) and surfaces as a
 * confusing downstream error such as "No export bundle found in the response". There is no
 * built-in fallback UI: react-wallet-kit shipped without one, and its `setMfaHandler`
 * docstring still describes a modal that was removed before launch.
 */
export function passkeyMfaHandler(
  httpClient: TurnkeySDKClientBase,
  onProgress?: (progress: MfaProgress) => void,
): (context: MfaContext) => Promise<void> {
  return async ({ fingerprint, organizationId, mfaStatuses }) => {
    if (!passkeyStillRequired(mfaStatuses)) {
      throw new Error(
        `This activity needs MFA, but not a passkey. Still outstanding: ${describeOutstandingMethods(
          mfaStatuses,
        )}.`,
      );
    }

    onProgress?.("requested");
    await httpClient.approveActivity(
      { fingerprint, organizationId },
      StamperType.Passkey,
    );
    onProgress?.("approved");
  };
}

/**
 * Logs in with an email OTP and returns the session token for the caller to store. The OTP
 * stamp presents EMAIL_OTP, so any other required factor is satisfied through `approve`.
 *
 * The long way round on purpose: `handleLogin()` would do all of this, since the built-in
 * modal calls `completeOtp` and the SDK resolves the challenge through `setMfaHandler`. This
 * is what you write instead when the login UI is yours.
 */
export async function otpMfaLogin(params: {
  httpClient: TurnkeySDKClientBase;
  /** The `verifyOtp` from `useTurnkey()`, which also points the attested stamper at the OTP. */
  verifyOtp: TurnkeyClientMethods["verifyOtp"];
  otpId: string;
  otpCode: string;
  otpEncryptionTargetBundle: string;
  contact: string;
  /** The parent organization id, used to catch an OTP that resolved to no sub-organization. */
  parentOrganizationId?: string;
  /**
   * Binds the session to a profile, and is readable by MFA conditions as
   * `activity.params.session_profile_id` (Scenario 4).
   */
  sessionProfileId?: string;
  /** Satisfies the factor the login stamp could not carry. Defaults to a passkey approval. */
  approve?: (challenge: {
    fingerprint: string;
    organizationId: string;
  }) => Promise<void>;
  onOtpVerified?: () => void;
  onProgress?: (progress: MfaProgress) => void;
}): Promise<string> {
  const {
    httpClient,
    verifyOtp,
    otpId,
    otpCode,
    otpEncryptionTargetBundle,
    contact,
    parentOrganizationId,
    sessionProfileId,
    approve,
    onOtpVerified,
    onProgress,
  } = params;

  const { verificationToken, publicKey } = await verifyOtp({
    otpId,
    otpCode,
    otpEncryptionTargetBundle,
  });
  onOtpVerified?.();

  // Resolve the sub-org this contact lives on (the verification token authorizes the PII
  // lookup). Every request below targets that sub-org.
  const { organizationId: subOrgId } = await httpClient.proxyGetAccount({
    filterType: "EMAIL",
    filterValue: contact,
    verificationToken,
  });
  if (!subOrgId) {
    throw new Error("No sub-organization found for this email.");
  }
  if (subOrgId === parentOrganizationId) {
    throw new Error(
      "OTP resolved to the parent organization. Run this scenario's setup with this email to create a sub-organization before testing MFA login.",
    );
  }

  const signedLoginRequest = await httpClient.stampStampLogin(
    {
      organizationId: subOrgId,
      publicKey,
      ...(sessionProfileId && { sessionProfileId }),
    },
    StamperType.Attested,
  );
  if (!signedLoginRequest) {
    throw new Error("Failed to create OTP login request.");
  }

  const loginResponse = await fetch(signedLoginRequest.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [signedLoginRequest.stamp.stampHeaderName]:
        signedLoginRequest.stamp.stampHeaderValue,
    },
    body: signedLoginRequest.body,
  });
  if (!loginResponse.ok) {
    throw new Error(await loginResponse.text());
  }

  // Satisfy the outstanding factor against the same fingerprint, then re-read for the result.
  let otpLoginRes = await loginResponse.json();
  if (
    otpLoginRes?.activity?.status === "ACTIVITY_STATUS_AUTHENTICATORS_NEEDED"
  ) {
    onProgress?.("requested");

    const challenge = {
      fingerprint: otpLoginRes.activity.fingerprint,
      organizationId: subOrgId,
    };

    if (approve) {
      await approve(challenge);
    } else {
      await httpClient.approveActivity(challenge, StamperType.Passkey);
    }

    onProgress?.("approved");

    otpLoginRes = await httpClient.getActivity(
      { activityId: otpLoginRes.activity.id, organizationId: subOrgId },
      StamperType.Attested,
    );
  }

  const session = otpLoginRes?.activity?.result?.stampLoginResult?.session;
  if (!session) {
    throw new Error(
      `OTP login did not return a session (activity status: ${otpLoginRes?.activity?.status}).`,
    );
  }

  return session;
}

/**
 * Deletes every MFA policy on the user so a scenario can be run again with the same email.
 * Without this, a second run fails with "mfa policy order must be unique".
 */
export async function deleteAllMfaPolicies(
  httpClient: TurnkeySDKClientBase,
  params: { userId: string; organizationId: string },
): Promise<number> {
  const { mfaPolicies } = await httpClient.getMfaPolicies(params);

  for (const policy of mfaPolicies) {
    await httpClient.deleteMfaPolicy({
      ...params,
      mfaPolicyId: policy.mfaPolicyId,
    });
  }

  return mfaPolicies.length;
}
