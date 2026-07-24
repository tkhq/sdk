"use client";

import {
  useTurnkey,
  ClientState,
  OtpType,
  StamperType,
} from "@turnkey/react-wallet-kit";
import { v1CreateMfaPolicyIntent } from "@turnkey/sdk-types";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { useEffect, useRef, useState } from "react";
import {
  DangerButton,
  formatError,
  Notice,
  PolicyGrid,
  PrimaryButton,
  ScenarioCard,
  ScenarioHeader,
  SecondaryButton,
  SessionInfo,
  StatusNotices,
  TextInput,
} from "./ui";

export const SESSION_KEY = "scenario-3";
const EXPORT_IFRAME_CONTAINER_ID = "scenario-3-export-iframe-container";
const EXPORT_IFRAME_ELEMENT_ID = "scenario-3-export-iframe";

export default function Scenario3() {
  const {
    handleLogin,
    handleAddPasskey,
    exportWallet,
    createWallet,
    initOtp,
    verifyOtp,
    storeSession,
    logout,
    allSessions,
    user,
    wallets,
    config,
    clientState,
    setMfaHandler,
    httpClient,
  } = useTurnkey();

  const session = allSessions?.[SESSION_KEY];
  const wallet = wallets?.[0];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [otpEncryptionTargetBundle, setOtpEncryptionTargetBundle] = useState<
    string | null
  >(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<"idle" | "requested" | "approved">(
    "idle",
  );
  const [exportCompleted, setExportCompleted] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportIframeReady, setExportIframeReady] = useState(false);
  const [exportIframeVisible, setExportIframeVisible] = useState(false);
  const [exportModalError, setExportModalError] = useState<string | null>(null);
  const exportIframeClientRef = useRef<IframeStamper | null>(null);
  const normalizedEmail = email.trim();
  const emailHasWhitespace = /\s/.test(email);

  const closeExportModal = () => {
    exportIframeClientRef.current?.clear();
    exportIframeClientRef.current = null;
    setExportModalOpen(false);
    setExportIframeReady(false);
    setExportIframeVisible(false);
    setExportModalError(null);
  };

  const authMfaPolicy = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Require OTP + passkey for auth",
    condition: "activity.resource == 'AUTH'",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_EMAIL_OTP" }] },
      { any: [{ type: "AUTHENTICATION_TYPE_PASSKEY" }] },
    ],
    order: 0,
  } as v1CreateMfaPolicyIntent;

  const exportMfaPolicy = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Require session + passkey for export",
    condition: "activity.action == 'EXPORT'",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_SESSION" }] },
      { any: [{ type: "AUTHENTICATION_TYPE_PASSKEY" }] },
    ],
    order: 1,
  } as v1CreateMfaPolicyIntent;

  const sessionMfaPolicy = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Require session for everything else",
    condition: "true",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_SESSION" }] },
    ],
    order: 2,
  } as v1CreateMfaPolicyIntent;

  // Export decrypts the wallet inside a sandboxed iframe hosted by Turnkey so the
  // key material never touches this app. Spin the iframe up when the modal opens,
  // its public key becomes the export target the enclave encrypts to.
  useEffect(() => {
    if (!exportModalOpen || exportIframeClientRef.current) return;

    const initExportIframe = async () => {
      try {
        const iframeUrl =
          config?.exportIframeUrl ?? "https://export.turnkey.com";
        const iframeContainer = document.getElementById(
          EXPORT_IFRAME_CONTAINER_ID,
        );

        if (!iframeContainer) {
          throw new Error("Export iframe container not found.");
        }

        const iframeClient = new IframeStamper({
          iframeUrl,
          iframeElementId: EXPORT_IFRAME_ELEMENT_ID,
          iframeContainer,
        });
        await iframeClient.init();
        iframeClient.iframe.className =
          "block w-full min-h-64 border-0 bg-white";

        exportIframeClientRef.current = iframeClient;
        setExportIframeReady(true);
      } catch (e: any) {
        setExportModalError(e?.message ?? String(e));
      }
    };

    initExportIframe();

    return () => {
      exportIframeClientRef.current?.clear();
      exportIframeClientRef.current = null;
    };
  }, [config?.exportIframeUrl, exportModalOpen]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  // Unlike Scenario 1 (handler installed for the whole session), here the passkey
  // MFA handler is only active around the wrapped call. The export activity comes
  // back AUTHENTICATORS_NEEDED, this handler approves it with the passkey, then it
  // is torn down so nothing else silently prompts for a passkey.
  const runWithPasskeyMfa = async (fn: () => Promise<void>) => {
    if (!httpClient) {
      throw new Error("Turnkey client is not ready.");
    }

    setMfaHandler(async ({ fingerprint, organizationId }) => {
      setMfaStatus("requested");
      await httpClient.approveActivity(
        { fingerprint, organizationId },
        StamperType.Passkey,
      );
      setMfaStatus("approved");
    });

    try {
      await fn();
    } finally {
      setMfaHandler(undefined);
    }
  };

  const validateEmail = () => {
    if (!normalizedEmail) {
      throw new Error("Enter an email address first.");
    }
    if (emailHasWhitespace) {
      throw new Error("Email cannot contain spaces.");
    }
  };

  const sendEmailOtp = async () => {
    validateEmail();

    // Proxy OTP - sends the email and returns the OTP id + encryption bundle.
    const { otpId, otpEncryptionTargetBundle } = await initOtp({
      otpType: OtpType.Email,
      contact: normalizedEmail,
    });

    setOtpId(otpId);
    setOtpEncryptionTargetBundle(otpEncryptionTargetBundle);
    setOtpVerified(false);
    setMfaStatus("idle");
    setExportCompleted(false);
  };

  const verifyOtpAndLogin = async () => {
    if (!otpId || !otpEncryptionTargetBundle) {
      throw new Error("Send an email OTP first.");
    }

    // Verify the OTP to get the verification token.
    const { verificationToken, publicKey } = await verifyOtp({
      otpId,
      otpCode,
      otpEncryptionTargetBundle,
    });
    setOtpVerified(true);

    // Resolve the sub-org this email lives on (the verification token authorizes
    // the PII lookup). Every request below targets this sub-org.
    const { organizationId: subOrgId } = await httpClient!.proxyGetAccount({
      filterType: "EMAIL",
      filterValue: normalizedEmail,
      verificationToken,
    });
    if (!subOrgId) {
      throw new Error("No sub-organization found for this email.");
    }
    if (subOrgId === config?.organizationId) {
      throw new Error(
        "OTP resolved to the parent organization. Run initial setup with this email to create a sub-organization before testing MFA login.",
      );
    }

    const signedLoginRequest = await httpClient!.stampStampLogin(
      { organizationId: subOrgId, publicKey },
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

    // The auth policy requires OTP + passkey. The OTP stamp satisfies the first
    // factor, so login returns AUTHENTICATORS_NEEDED, approve it with the passkey,
    // then re-read the activity to pick up the resulting session.
    let otpLoginRes = await loginResponse.json();
    if (
      otpLoginRes?.activity?.status === "ACTIVITY_STATUS_AUTHENTICATORS_NEEDED"
    ) {
      setMfaStatus("requested");
      await httpClient!.approveActivity(
        {
          fingerprint: otpLoginRes.activity.fingerprint,
          organizationId: subOrgId,
        },
        StamperType.Passkey,
      );
      setMfaStatus("approved");

      otpLoginRes = await httpClient!.getActivity(
        {
          activityId: otpLoginRes.activity.id,
          organizationId: subOrgId,
        },
        StamperType.Attested,
      );
    }

    const session = otpLoginRes?.activity?.result?.stampLoginResult?.session;
    if (!session) {
      throw new Error(
        `OTP login did not return a session (activity status: ${otpLoginRes?.activity?.status}).`,
      );
    }

    // The activity path returns the session JWT but doesn't persist it — store
    // it under our session key so the UI picks it up.
    await storeSession({ sessionToken: session, sessionKey: SESSION_KEY });
  };

  const createWalletForExport = async () => {
    await createWallet({
      walletName: `Scenario 3 Wallet ${Date.now()}`,
      accounts: ["ADDRESS_FORMAT_ETHEREUM"],
    });
  };

  const createMfaPolicies = async () => {
    await httpClient!.createMfaPolicy(authMfaPolicy);
    await httpClient!.createMfaPolicy(exportMfaPolicy);
    await httpClient!.createMfaPolicy(sessionMfaPolicy);
  };

  const exportWalletWithModal = async () => {
    if (!wallet?.walletId) {
      throw new Error("Create a wallet before exporting.");
    }

    setExportModalOpen(true);
  };

  const injectExportBundleIntoModal = async () => {
    if (!wallet?.walletId) {
      throw new Error("Create a wallet before exporting.");
    }

    const iframeClient = exportIframeClientRef.current;
    if (!iframeClient?.iframePublicKey) {
      throw new Error("Export iframe is not ready yet.");
    }

    setMfaStatus("idle");
    setExportCompleted(false);
    setExportModalError(null);

    // exportWallet trips the EXPORT policy; runWithPasskeyMfa (wrapping this call)
    // handles the passkey approval. The returned bundle is encrypted to the
    // iframe's public key, so only the iframe can decrypt and display it.
    const bundle = await exportWallet({
      walletId: wallet.walletId,
      targetPublicKey: iframeClient.iframePublicKey,
      ...(session?.organizationId && {
        organizationId: session.organizationId,
      }),
    });

    await iframeClient.injectWalletExportBundle(
      bundle,
      session!.organizationId,
    );

    setExportIframeVisible(true);
    setExportCompleted(true);
  };

  return (
    <ScenarioCard>
      <ScenarioHeader
        title="Scenario 3"
        subtitle="MFA login, export requires session + passkey"
      />

      {session && (
        <SessionInfo session={session}>
          {wallet?.walletId && <div>Wallet: {wallet.walletId}</div>}
        </SessionInfo>
      )}

      {session ? (
        <>
          <PrimaryButton
            disabled={loading}
            onClick={() => run(() => handleAddPasskey().then(() => {}))}
          >
            1. Add Passkey
          </PrimaryButton>

          <PrimaryButton
            disabled={loading || !!wallet?.walletId}
            onClick={() => run(createWalletForExport)}
          >
            2. Create Wallet
          </PrimaryButton>

          <div className="w-full flex flex-col gap-2">
            <PrimaryButton
              disabled={loading}
              onClick={() => run(createMfaPolicies)}
            >
              3. Create MFA Policies
            </PrimaryButton>
            <PolicyGrid
              policies={[authMfaPolicy, exportMfaPolicy, sessionMfaPolicy]}
            />
          </div>

          <PrimaryButton
            disabled={loading || !wallet?.walletId}
            onClick={() => run(exportWalletWithModal)}
          >
            4. Export Wallet (triggers passkey MFA)
          </PrimaryButton>

          {exportModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4">
              <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
                <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-black">
                      Export Wallet
                    </h3>
                    <p className="text-xs text-black">
                      Requires your active session and passkey approval.
                    </p>
                  </div>
                  <button
                    onClick={closeExportModal}
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-black hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>

                <div className="flex flex-col gap-4 bg-white p-5">
                  {!exportIframeVisible && (
                    <PrimaryButton
                      disabled={loading || !exportIframeReady}
                      onClick={() =>
                        run(() =>
                          runWithPasskeyMfa(injectExportBundleIntoModal),
                        )
                      }
                    >
                      {exportIframeReady
                        ? "Confirm Export"
                        : "Preparing Export"}
                    </PrimaryButton>
                  )}

                  <div
                    id={EXPORT_IFRAME_CONTAINER_ID}
                    className={
                      exportIframeVisible
                        ? "min-h-64 overflow-hidden rounded border border-gray-200 bg-white"
                        : "h-0 overflow-hidden"
                    }
                  />

                  {exportIframeVisible && (
                    <Notice>Wallet export is displayed above.</Notice>
                  )}

                  {exportModalError && (
                    <Notice tone="error">
                      {formatError(exportModalError)}
                    </Notice>
                  )}
                </div>
              </div>
            </div>
          )}

          {clientState === ClientState.Ready && (
            <DangerButton
              disabled={loading}
              onClick={() => logout({ sessionKey: SESSION_KEY })}
            >
              Logout Before Testing Auth
            </DangerButton>
          )}
        </>
      ) : (
        <div className="w-full flex flex-col gap-4">
          {clientState === ClientState.Ready && !otpId && (
            <SecondaryButton
              onClick={() => handleLogin({ sessionKey: SESSION_KEY })}
            >
              Initial Setup Login / Sign Up
            </SecondaryButton>
          )}

          <div className="w-full flex flex-col gap-2">
            <TextInput value={email} onChange={setEmail} placeholder="Email" />
            <PrimaryButton
              disabled={loading || !normalizedEmail || emailHasWhitespace}
              onClick={() => run(sendEmailOtp)}
            >
              1. Send Email OTP
            </PrimaryButton>
          </div>

          <div className="w-full flex flex-col gap-2">
            <TextInput
              value={otpCode}
              onChange={setOtpCode}
              placeholder="OTP code"
            />
            <PrimaryButton
              disabled={loading || !otpId || !otpCode}
              onClick={() => run(verifyOtpAndLogin)}
            >
              2. Verify OTP + Passkey Login
            </PrimaryButton>
          </div>
        </div>
      )}

      <StatusNotices
        otpSent={!!otpId}
        otpVerified={otpVerified}
        mfaStatus={mfaStatus}
        exportCompleted={exportCompleted}
        error={error}
      />
    </ScenarioCard>
  );
}
