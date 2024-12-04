import styles from "./Auth.module.css";
import React, { useEffect, useState } from "react";
import { initOtpAuth, getSuborgs, createSuborg, oauth } from "../../actions/";
import { MuiPhone } from "./PhoneInput";
import GoogleAuthButton from "./Google";
import AppleAuthButton from "./Apple";
import FacebookAuthButton from "./Facebook";
import { CircularProgress, TextField } from "@mui/material";
import turnkeyIcon from "assets/turnkey.svg";
import googleIcon from "assets/google.svg";
import facebookIcon from "assets/facebook.svg";
import appleIcon from "assets/apple.svg";
import passkeyIcon from "assets/passkey.svg";
import passkeyIconRed from "assets/passkey-red.svg";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import OtpVerification from "./OtpVerification";
import { useTurnkey } from "../../hooks/use-turnkey";

interface AuthProps {
  onHandleAuthSuccess: () => Promise<void>;
  onError: (errorMessage: string) => void;
  authConfig: {
    emailEnabled: boolean;
    passkeyEnabled: boolean;
    phoneEnabled: boolean;
    appleEnabled: boolean;
    facebookEnabled: boolean;
    googleEnabled: boolean;
  };
  configOrder: string[];
}

const Auth: React.FC<AuthProps> = ({
  onHandleAuthSuccess,
  onError,
  authConfig,
  configOrder,
}) => {
  const { passkeyClient, authIframeClient } = useTurnkey();
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [step, setStep] = useState<string>("auth");
  const [oauthLoading, setOauthLoading] = useState<string>("");
  const [suborgId, setSuborgId] = useState<string>("");
  const [passkeySignupScreen, setPasskeySignupScreen] = useState(false);
  const [passkeyCreationScreen, setPasskeyCreationScreen] = useState(false);
  const [passkeySignupError, setPasskeySignupError] = useState("");
  const [loading, setLoading] = useState(true);
  const [passkeyCreated, setPasskeyCreated] = useState(false);

  const handleResendCode = async () => {
    if (step === "otpEmail") {
      await handleOtpLogin("EMAIL", email, "OTP_TYPE_EMAIL");
    } else if (step === "otpPhone") {
      await handleOtpLogin("PHONE_NUMBER", phone, "OTP_TYPE_SMS");
    }
  };

  useEffect(() => {
    if (authIframeClient) {
      setLoading(false);
    }
  }, [authIframeClient]);

  if (loading) {
    return (
      <div className={styles.defaultLoader}>
        <CircularProgress
          size={80}
          thickness={1}
          className={styles.circularProgress!}
        />
      </div>
    );
  }

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isValidPhone = (phone: string) => /^\+1\d{10}$/.test(phone);

  const handleGetOrCreateSuborg = async (
    filterType: string,
    filterValue: string,
    additionalData = {}
  ) => {
    const getSuborgsResponse = await getSuborgs({ filterType, filterValue });
    if (!getSuborgsResponse || !getSuborgsResponse.organizationIds) {
      onError("Failed to fetch account");
    }
    let suborgId = getSuborgsResponse?.organizationIds[0];

    if (!suborgId) {
      const createSuborgData: Record<string, any> = { ...additionalData };
      if (filterType === "EMAIL") createSuborgData.email = filterValue;
      else if (filterType === "PHONE_NUMBER")
        createSuborgData.phoneNumber = filterValue;

      const createSuborgResponse = await createSuborg(createSuborgData);
      if (!createSuborgResponse || !createSuborgResponse.subOrganizationId) {
        onError("Failed to create account");
      }
      suborgId = createSuborgResponse?.subOrganizationId!;
    }
    return suborgId;
  };

  const handleAuthSuccess = async (credentialBundle: any) => {
    if (credentialBundle) {
      await authIframeClient!.injectCredentialBundle(credentialBundle);
      await authIframeClient!.loginWithAuthBundle(credentialBundle);
      await onHandleAuthSuccess();
    }
  };

  const handleSignupWithPasskey = async () => {
    setPasskeySignupError("");
    const siteInfo = `${window.location.href} - ${new Date().toLocaleString(
      undefined,
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    )}`;
    setPasskeySignupScreen(false);
    setPasskeyCreationScreen(true);
    try {
      if (!passkeyCreated) {
        const { encodedChallenge, attestation } =
          (await passkeyClient?.createUserPasskey({
            publicKey: { user: { name: siteInfo, displayName: siteInfo } },
          })) || {};

        if (encodedChallenge && attestation) {
          await createSuborg({
            email,
            passkey: {
              authenticatorName: "First Passkey",
              challenge: encodedChallenge,
              attestation,
            },
          });
          setPasskeyCreated(true);
        } else {
          setPasskeySignupError("Passkey not created. Please try again.");
        }
      }

      const sessionResponse = await passkeyClient?.createReadWriteSession({
        targetPublicKey: authIframeClient?.iframePublicKey!,
        organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      });
      if (sessionResponse?.credentialBundle) {
        await handleAuthSuccess(sessionResponse.credentialBundle);
        setPasskeyCreationScreen(false);
        setPasskeySignupError("");
      } else {
        setPasskeySignupError("Failed to login with passkey. Please try again");
      }
    } catch {
      setPasskeySignupError(
        "The operation either timed out or was not allowed. Please try again"
      );
    }
  };

  const handleLoginWithPasskey = async () => {
    try {
      const sessionResponse = await passkeyClient?.createReadWriteSession({
        targetPublicKey: authIframeClient?.iframePublicKey!,
        organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      });

      if (sessionResponse?.credentialBundle) {
        await handleAuthSuccess(sessionResponse.credentialBundle);
      } else {
        onError("Failed to login with passkey");
      }
    } catch (error) {
      onError("Failed to login with passkey");
    }
  };

  const handleOtpLogin = async (
    type: "EMAIL" | "PHONE_NUMBER",
    value: string,
    otpType: string
  ) => {
    const suborgId = await handleGetOrCreateSuborg(type, value);
    const initAuthResponse = await initOtpAuth({
      suborgID: suborgId,
      otpType,
      contact: value,
    });
    if (initAuthResponse && initAuthResponse.otpId) {
      setSuborgId(suborgId);
      setOtpId(initAuthResponse?.otpId!);
      setStep(type === "EMAIL" ? "otpEmail" : "otpPhone");
    } else {
      onError("Failed to send OTP");
    }
  };

  const handleOAuthLogin = async (credential: string, providerName: string) => {
    setOauthLoading(providerName);
    const suborgId = await handleGetOrCreateSuborg("OIDC_TOKEN", credential, {
      oauthProviders: [{ providerName, oidcToken: credential }],
    });
    const oauthResponse = await oauth({
      suborgID: suborgId,
      oidcToken: credential,
      targetPublicKey: authIframeClient?.iframePublicKey!,
    });
    if (oauthResponse && oauthResponse.credentialBundle) {
      await handleAuthSuccess(oauthResponse!.credentialBundle);
    } else {
      onError("Failed to login with OIDC provider");
    }
  };

  const renderBackButton = () => (
    <ChevronLeftIcon
      onClick={() => {
        setPasskeyCreationScreen(false);
        setPasskeySignupError("");
        setPasskeySignupScreen(false);
        setOtpId(null);
      }}
      sx={{
        color: "var(--text-secondary)",
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 10,
        cursor: "pointer",
        borderRadius: "50%",
        padding: "6px",
        transition: "background-color 0.3s ease",
        "&:hover": {
          backgroundColor: "var(--button-hover-bg)",
        },
      }}
    />
  );

  const renderSocialButtons = () => {
    const { googleEnabled, appleEnabled, facebookEnabled } = authConfig;
    const layout =
      [googleEnabled, appleEnabled, facebookEnabled].filter(Boolean).length >= 2
        ? "inline"
        : "stacked";

    return (
      <div
        className={
          layout === "inline"
            ? styles.socialButtonContainerInline
            : styles.socialButtonContainerStacked
        }
      >
        {googleEnabled && (
          <GoogleAuthButton
            layout={layout}
            clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
            iframePublicKey={authIframeClient!.iframePublicKey!}
            onSuccess={(response: any) =>
              handleOAuthLogin(response.idToken, "Google")
            }
          />
        )}
        {appleEnabled && (
          <AppleAuthButton
            layout={layout}
            clientId={process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!}
            iframePublicKey={authIframeClient!.iframePublicKey!}
            onSuccess={(response: any) =>
              handleOAuthLogin(response.idToken, "Apple")
            }
          />
        )}
        {facebookEnabled && (
          <FacebookAuthButton
            layout={layout}
            clientId={process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID!}
            iframePublicKey={authIframeClient!.iframePublicKey!}
            onSuccess={(response: any) =>
              handleOAuthLogin(response.id_token, "Facebook")
            }
          />
        )}
      </div>
    );
  };

  const renderSection = (section: string) => {
    switch (section) {
      case "email":
        return authConfig.emailEnabled && !otpId ? (
          <div>
            <div className={styles.inputGroup}>
              <TextField
                name="emailInput"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                sx={{
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": {
                      borderColor: "var(--input-border)",
                    },
                    "&:hover fieldset": {
                      borderColor: "var(--input-hover-border)",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "var(--input-focus-border)",
                      border: "1px solid",
                    },
                  },
                  "& .MuiInputBase-input": {
                    padding: "12px",
                  },
                  backgroundColor: "var(--input-bg)",
                }}
                variant="outlined"
              />
            </div>
            <button
              className={styles.authButton}
              type="button"
              onClick={() => handleOtpLogin("EMAIL", email, "OTP_TYPE_EMAIL")}
              disabled={!isValidEmail(email)}
            >
              Continue
            </button>
          </div>
        ) : null;

      case "passkey":
        return authConfig.passkeyEnabled && !otpId ? (
          <div className={styles.passkeyContainer}>
            <button
              className={styles.authButton}
              type="button"
              onClick={handleLoginWithPasskey}
            >
              Log in with passkey
            </button>
            <div
              className={styles.noPasskeyLink}
              onClick={() => setPasskeySignupScreen(true)}
            >
              Sign up with passkey
            </div>
          </div>
        ) : null;

      case "phone":
        return authConfig.phoneEnabled && !otpId ? (
          <div>
            <div className={styles.phoneInput}>
              <MuiPhone onChange={(value) => setPhone(value)} value={phone} />
            </div>
            <button
              className={styles.authButton}
              type="button"
              onClick={() =>
                handleOtpLogin("PHONE_NUMBER", phone, "OTP_TYPE_SMS")
              }
              disabled={!isValidPhone(phone)}
            >
              Continue
            </button>
          </div>
        ) : null;

      case "socials":
        return authConfig.googleEnabled ||
          authConfig.appleEnabled ||
          authConfig.facebookEnabled
          ? renderSocialButtons()
          : null;

      default:
        return null;
    }
  };

  return (
    <>
      {passkeySignupScreen ? (
        <div className={styles.authCard}>
          {renderBackButton()}
          <div className={styles.passkeyIconContainer}>
            <img src={passkeyIcon} />
          </div>
          <center>
            <h3>Create a passkey</h3>
          </center>
          <div className={styles.rowsContainer}>
            <center>
              Passkeys allow for easy biometric access to your wallet and can be
              synced across devices.
            </center>
          </div>
          <button
            className={styles.authButton}
            type="button"
            onClick={handleSignupWithPasskey}
          >
            Continue
          </button>
        </div>
      ) : passkeyCreationScreen ? (
        <div className={styles.authCard}>
          {renderBackButton()}
          <div className={styles.passkeyIconContainer}>
            {passkeySignupError ? (
              <div className={styles.loadingWrapper}>
                <img src={passkeyIconRed} />
              </div>
            ) : (
              <div className={styles.loadingWrapper}>
                <CircularProgress
                  size={80}
                  thickness={1}
                  className={styles.circularProgress!}
                />
                <img src={passkeyIcon} />
              </div>
            )}
          </div>
          <center>
            <h3>
              {passkeySignupError
                ? "Authentication error"
                : passkeyCreated
                ? "Logging in with passkey..."
                : "Creating passkey..."}
            </h3>
          </center>
          <div className={styles.rowsContainer}>
            <center>{passkeySignupError ? passkeySignupError : ""}</center>
          </div>
          {passkeySignupError && (
            <button
              className={styles.authButton}
              type="button"
              onClick={handleSignupWithPasskey}
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <div>
          {oauthLoading !== "" ? (
            <div className={styles.authCardLoading}>
              <h3 className={styles.verifyingText}>
                Verifying with {oauthLoading}
              </h3>
              <div className={styles.loadingWrapper}>
                <CircularProgress
                  size={80}
                  thickness={1}
                  className={styles.circularProgress!}
                />
                {oauthLoading === "Google" && (
                  <img src={googleIcon} className={styles.oauthIcon} />
                )}
                {oauthLoading === "Facebook" && (
                  <img src={facebookIcon} className={styles.oauthIcon} />
                )}
                {oauthLoading === "Apple" && (
                  <img src={appleIcon} className={styles.oauthIcon} />
                )}
              </div>
              <div className={styles.poweredBy}>
                <span>Secured by</span>
                <img src={turnkeyIcon} />
              </div>
            </div>
          ) : (
            <div className={styles.authCard}>
              {otpId && renderBackButton()}
              <h2>{!otpId && "Log in or sign up"}</h2>
              <div className={styles.authForm}>
                {!otpId &&
                  configOrder
                    .filter((section) => renderSection(section) !== null)
                    .map((section, index, visibleSections) => (
                      <React.Fragment key={section}>
                        {renderSection(section)}
                        {index < visibleSections.length - 1 && (
                          <div className={styles.separator}>
                            <span>OR</span>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                {otpId && (
                  <OtpVerification
                    type={step}
                    contact={step === "otpEmail" ? email : phone}
                    suborgId={suborgId}
                    otpId={otpId!}
                    authIframeClient={authIframeClient!}
                    onValidateSuccess={handleAuthSuccess}
                    onResendCode={handleResendCode}
                  />
                )}

                {!otpId && (
                  <div className={styles.tos}>
                    <span>
                      By continuing, you agree to our{" "}
                      <a
                        href="https://www.turnkey.com/legal/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.tosBold}
                      >
                        Terms of Service
                      </a>{" "}
                      &{" "}
                      <a
                        href="https://www.turnkey.com/legal/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.tosBold}
                      >
                        Privacy Policy
                      </a>
                      {"."}
                    </span>
                  </div>
                )}
              </div>
              <div
                onClick={() =>
                  (window.location.href = "https://www.turnkey.com/")
                }
                className={styles.poweredBy}
              >
                <span>Secured by</span>
                <img src={turnkeyIcon} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default Auth;
