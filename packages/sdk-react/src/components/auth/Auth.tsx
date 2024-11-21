import styles from "./Auth.module.css";
import React, { useEffect, useRef, useState } from "react";
import { useTurnkey } from "../../hooks/useTurnkey";
import {
  initOtpAuth,
  otpAuth,
  getSuborgs,
  createSuborg,
  oauth,
} from "../../actions/";
import { MuiPhone } from "./PhoneInput";
import OtpInput from "./otp";
import GoogleAuthButton from "./Google";
import AppleAuthButton from "./Apple";
import FacebookAuthButton from "./Facebook";
import { CircularProgress, TextField } from "@mui/material";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import turnkeyIcon from "assets/turnkey.svg";
import googleIcon from "assets/google.svg";
import facebookIcon from "assets/facebook.svg";
import appleIcon from "assets/apple.svg";
import emailIcon from "assets/email.svg";
import smsIcon from "assets/sms.svg";
import faceidIcon from "assets/faceid.svg";
import fingerprintIcon from "assets/fingerprint.svg";
import redcircleIcon from "assets/redcircle.svg"
import fingerprintredIcon from "assets/fingerprintred.svg"
import checkboxIcon from "assets/checkbox.svg";
import clockIcon from "assets/clock.svg";
import keyholeIcon from "assets/keyhole.svg";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";

interface AuthProps {
  onHandleAuthSuccess: () => Promise<void>;
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

const Auth: React.FC<AuthProps> = ({ onHandleAuthSuccess, authConfig, configOrder }) => {
  const { passkeyClient, authIframeClient } = useTurnkey();
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [step, setStep] = useState<string>("auth");
  const [oauthLoading, setOauthLoading] = useState<string>("");
  const [suborgId, setSuborgId] = useState<string>("");
  const [resendText, setResendText] = useState("Resend code");
  const [passkeySignupScreen, setPasskeySignupScreen] = useState(false);
  const [passkeyCreationScreen, setPasskeyCreationScreen] = useState(false);
  const [passkeySignupError, setPasskeySignupError] = useState("");
  const [loading, setLoading] = useState(true);
  const [passkeyCreated, setPasskeyCreated] = useState(false);

  const otpInputRef = useRef<any>(null);

  const handleResendCode = async () => {
    setOtpError(null);
    if (step === "otpEmail") {
      await handleOtpLogin("EMAIL", email, "OTP_TYPE_EMAIL");
    } else if (step === "otpPhone") {
      await handleOtpLogin("PHONE_NUMBER", phone, "OTP_TYPE_SMS");
    }
    setResendText("Code sent ✓");
    
    setTimeout(() => {
      setResendText("Resend code");
    }, 15000); 
  };
  
  const formatPhoneNumber = (phone: string) => {
    const phoneNumber = parsePhoneNumberFromString(phone);
    return phoneNumber ? phoneNumber.formatInternational() : phone;
  };

  useEffect(() => {
    if (error) {
      alert(error);
    }
  }, [error]);

  useEffect(() => {
    if (authIframeClient) {
      setLoading(false);
    }
  }, [authIframeClient]);

  if (loading) {
    return <></>;
  }

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isValidPhone = (phone: string) => /^\+1\d{10}$/.test(phone);

  const handleGetOrCreateSuborg = async (
    filterType: string,
    filterValue: string,
    additionalData = {}
  ) => {
    const getSuborgsResponse = await getSuborgs({ filterType, filterValue });
    let suborgId = getSuborgsResponse?.organizationIds[0];

    if (!suborgId) {
      const createSuborgData: Record<string, any> = { ...additionalData };
      if (filterType === "EMAIL") createSuborgData.email = filterValue;
      else if (filterType === "PHONE_NUMBER") createSuborgData.phoneNumber = filterValue;

      const createSuborgResponse = await createSuborg(createSuborgData);
      suborgId = createSuborgResponse?.subOrganizationId!;
    }
    return suborgId;
  };

  const handleAuthSuccess = async (credentialBundle: any) => {
    if (credentialBundle) {
      await authIframeClient!.injectCredentialBundle(credentialBundle);
      await authIframeClient!.loginWithAuthBundle(credentialBundle)
      await onHandleAuthSuccess();
    }
  };

  const handleSignupWithPasskey = async () => {
    setPasskeySignupError("")
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
    setPasskeySignupScreen(false)
    setPasskeyCreationScreen(true)
    try {
      if (!passkeyCreated){
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
      setPasskeyCreated(true)
    } else {
      setPasskeySignupError("Failed to create user passkey. Please try again")
    }
  }
  
    const sessionResponse = await passkeyClient?.createReadWriteSession({
      targetPublicKey: authIframeClient?.iframePublicKey!,
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });
    if (sessionResponse?.credentialBundle) {
      await handleAuthSuccess(sessionResponse.credentialBundle);
    } else {
      setPasskeySignupError("Failed to login with passkey. Please try again")
    }
    setPasskeyCreationScreen(false)
    setPasskeySignupError("")
  }
  catch {
    setPasskeySignupError("Passkey request timed out or rejected by user. Please try again")
  }
  };

  const handleLoginWithPasskey = async () => {
    const sessionResponse = await passkeyClient?.createReadWriteSession({
      targetPublicKey: authIframeClient?.iframePublicKey!,
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });
    if (sessionResponse?.credentialBundle) {
      await handleAuthSuccess(sessionResponse.credentialBundle);
    } else {
      setError("Failed to complete passkey login.");
    }
  };

  const handleOtpLogin = async (type: "EMAIL" | "PHONE_NUMBER", value: string, otpType: string) => {
    const suborgId = await handleGetOrCreateSuborg(type, value);
    const initAuthResponse = await initOtpAuth({ suborgID: suborgId, otpType, contact: value });
    setSuborgId(suborgId);
    setOtpId(initAuthResponse?.otpId!);
    setStep(type === "EMAIL" ? "otpEmail" : "otpPhone");
  };

  const handleValidateOtp = async (otp: string) => {
    setOtpError(null);
    const authResponse = await otpAuth({
      suborgID: suborgId,
      otpId: otpId!,
      otpCode: otp,
      targetPublicKey: authIframeClient!.iframePublicKey!,
    });
    authResponse?.credentialBundle
      ? await handleAuthSuccess(authResponse.credentialBundle)
      : setOtpError("Invalid code. Please try again");
    otpInputRef.current.resetOtp();
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
    await handleAuthSuccess(oauthResponse!.credentialBundle);
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
    color: "#868c95",
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
    cursor: "pointer",
    borderRadius: "50%", 
    padding: "6px", 
    transition: "background-color 0.3s ease", 
    "&:hover": {
      backgroundColor: "#e0e3ea",
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
              handleOAuthLogin(response.authorization.id_token, "Apple")
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
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                sx={{
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": {
                      borderColor: "#D0D5DD",
                    },
                    "&:hover fieldset": {
                      borderColor: "#8A929E",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#D0D5DD",
                      border: "1px solid",
                    },
                  },
                  "& .MuiInputBase-input": {
                    padding: "12px",
                  },
                  backgroundColor: "white",
                }}
                variant="outlined"
              />
            </div>
            <button
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
            <button type="button" onClick={handleLoginWithPasskey}>
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
              type="button"
              onClick={() => handleOtpLogin("PHONE_NUMBER", phone, "OTP_TYPE_SMS")}
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
            <img src={faceidIcon} />
            <img src={fingerprintIcon} />
          </div>
          <center>
            <h3>Secure your account with a passkey</h3>
          </center>
          <div className={styles.rowsContainer}>
            <div className={styles.row}>
              <img src={checkboxIcon} className={styles.rowIcon} />
              <span>Log in with Touch ID, Face ID, or a security key</span>
            </div>
            <div className={styles.row}>
              <img src={keyholeIcon} className={styles.rowIcon} />
              <span>More secure than a password</span>
            </div>
            <div className={styles.row}>
              <img src={clockIcon} className={styles.rowIcon} />
              <span>Takes seconds to set up and use</span>
            </div>
          </div>
          <button type="button" onClick={handleSignupWithPasskey}>
            Create a passkey
          </button>
        </div>
      ) : passkeyCreationScreen ?         <div className={styles.authCard}>
      {renderBackButton()}
      <div className={styles.passkeyIconContainer}>
      <div className={styles.loadingWrapper}>
        { !passkeySignupError ?
        <>
                <CircularProgress
                  size={80}
                  thickness={1}
                  className={styles.circularProgress!}
                />
<img src={fingerprintIcon} />
</> :
<>
<img src={redcircleIcon} style = {{  position: "absolute"}}/>
<img src={fingerprintredIcon} />
</>
}
              </div>
      </div>
      <center>
        <h3>{passkeySignupError ? "Something went wrong" : passkeyCreated ? "Logging in with passkey" : "Creating passkey"}</h3>
      </center>
      <div className={styles.rowsContainer}>
        <center>

          {passkeySignupError ? passkeySignupError : "Please follow prompts to verify your passkey"}
    
      </center>
      </div>
      { passkeySignupError &&
      <button type="button" onClick={handleSignupWithPasskey}>
        Retry
      </button>
}
    </div> :(
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
                <span>Powered by</span>
                <img src={turnkeyIcon} />
              </div>
            </div>
          ) : (
            <div className={styles.authCard}>
              {otpId && renderBackButton()}
              <h2>{otpId ? "Enter verification code" : "Log in or sign up"}</h2>
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
                  <div>
                    <div className={styles.verification}>
                      <div className={styles.verificationIcon}>
                        {step === "otpEmail" ? (
                          <img src={emailIcon} />
                        ) : (
                          <img src={smsIcon} />
                        )}
                      </div>

                      <span>
                        Enter the 6-digit code we sent to{" "}
                        <div className={styles.verificationBold}>
                          {step === "otpEmail"
                            ? email
                            : formatPhoneNumber(phone)}
                        </div>
                      </span>
                      <OtpInput
                        ref={otpInputRef}
                        onComplete={handleValidateOtp}
                        hasError={!!otpError}
                      />
                    </div>
                    <div className={styles.errorText}>
                      {otpError ? otpError : " "}
                    </div>
                  </div>
                )}

                {!otpId ? (
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
                    </span>
                  </div>
                ) : (
                  <div className={styles.resendCode}>
                    <span>
                      <span
                        onClick={
                          resendText === "Resend code"
                            ? handleResendCode
                            : undefined
                        }
                        style={{
                          cursor:
                            resendText === "Resend code"
                              ? "pointer"
                              : "not-allowed",
                        }}
                        className={styles.resendCodeBold}
                      >
                        {resendText}
                      </span>
                    </span>
                  </div>
                )}
              </div>
              <div
                onClick={() => (window.location.href = "https://www.turnkey.com/")}
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
