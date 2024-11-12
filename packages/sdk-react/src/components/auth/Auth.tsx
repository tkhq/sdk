import styles from "./Auth.module.css";
import { useEffect, useRef, useState } from "react";
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
import { CircularProgress } from "@mui/material";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import turnkeyIcon from "assets/turnkey.svg";
import googleIcon from "assets/google.svg";
import facebookIcon from "assets/facebook.svg";
import appleIcon from "assets/apple.svg";
import emailIcon from "assets/email.svg";
import smsIcon from "assets/sms.svg";
import faceidIcon from "assets/faceid.svg";
import fingerprintIcon from "assets/fingerprint.svg";
import checkboxIcon from "assets/checkbox.svg";
import clockIcon from "assets/clock.svg";
import keyholeIcon from "assets/keyhole.svg";
import React from "react";

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
  const [resendText, setResendText] = useState("Re-send Code");
  const [passkeySignupScreen, setPasskeySignupScreen] = useState(false);
  const otpInputRef = useRef<any>(null);

  const handleResendCode = async () => {
    setOtpError(null);
    if (step === "otpEmail") {
      await handleOtpLogin("EMAIL", email, "OTP_TYPE_EMAIL");
    } else if (step === "otpPhone") {
      await handleOtpLogin("PHONE_NUMBER", phone, "OTP_TYPE_SMS");
    }
    setResendText("Code Sent ✓");
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
      await onHandleAuthSuccess();
    }
  };

  const handleSignupWithPasskey = async () => {
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
    const { encodedChallenge, attestation } =
      (await passkeyClient?.createUserPasskey({
        publicKey: { user: { name: siteInfo, displayName: siteInfo } },
      })) || {};

    if (encodedChallenge && attestation) {
      // Use the generated passkey to create a new suborg
      await createSuborg({
        email,
        passkey: {
          authenticatorName: "First Passkey",
          challenge: encodedChallenge,
          attestation,
        },
      });
    } else {
      setError("Failed to create user passkey.");
    }
    const sessionResponse = await passkeyClient?.createReadWriteSession({
      targetPublicKey: authIframeClient?.iframePublicKey!,
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!
    });
    if (sessionResponse?.credentialBundle) {
      await handleAuthSuccess(sessionResponse.credentialBundle);
    } else {
      setError("Failed to complete passkey login.");
    }
  };
  const handleLoginWithPasskey = async () => {
    const sessionResponse = await passkeyClient?.createReadWriteSession({
      targetPublicKey: authIframeClient?.iframePublicKey!,
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!
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

  const renderSection = (section: string) => {
    
    switch (section) {
      case "email":
        return authConfig.emailEnabled && !otpId ? (
          <div>
            <div className={styles.inputGroup}>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => handleOtpLogin("EMAIL", email, "OTP_TYPE_EMAIL")}
              disabled={!isValidEmail(email)}
            >
              Continue with email
            </button>
          </div>
        ) : null;

      case "passkey":
        return authConfig.passkeyEnabled && !otpId ? (
          <div className={styles.passkeyContainer}>
            <button type="button" onClick={handleLoginWithPasskey}>Continue with passkey</button>
            <div className={styles.noPasskeyLink} onClick={() => setPasskeySignupScreen(true)}>
              I don't have a passkey
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
              Continue with phone
            </button>
          </div>
        ) : null;

      case "socials":
        return (authConfig.googleEnabled || authConfig.appleEnabled || authConfig.facebookEnabled) ? (

<div>

            {authConfig.googleEnabled && (
                                        <div className={styles.authButton}>
                                        <div className={styles.socialButtonContainer}>
              <GoogleAuthButton
                clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
                iframePublicKey={authIframeClient!.iframePublicKey!}
                onSuccess={(response: any) => handleOAuthLogin(response.credential, "Google")}
              />
              </div></div>
            )}
            {authConfig.appleEnabled && (
                            <div className={styles.authButton}>
                            <div className={styles.socialButtonContainer}>
              <AppleAuthButton
                clientId={process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!}
                iframePublicKey={authIframeClient!.iframePublicKey!}
                onSuccess={(response: any) => handleOAuthLogin(response.authorization.id_token, "Apple")}
              />
              </div></div>
            )}
            {authConfig.facebookEnabled && (
                                            <div className={styles.authButton}>
                                            <div className={styles.socialButtonContainer}>
              <FacebookAuthButton
                clientId={process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID!}
                iframePublicKey={authIframeClient!.iframePublicKey!}
                onSuccess={(response: any) => handleOAuthLogin(response.id_token, "Facebook")}
              />
              </div></div>
            )}
            </div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <>
        {passkeySignupScreen ?
            <div className={styles.authCard}>
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
            </div> :
    <div>
      {oauthLoading !== "" ? (
        <div className={styles.authCardLoading}>
          <h3 className={styles.verifyingText}>Verifying with {oauthLoading}</h3>
          <div className={styles.loadingWrapper}>
            <CircularProgress size={100} thickness={1} className={styles.circularProgress!} />
            {oauthLoading === "Google" && <img src={googleIcon} className={styles.oauthIcon} />}
            {oauthLoading === "Facebook" && <img src={facebookIcon} className={styles.oauthIcon} />}
            {oauthLoading === "Apple" && <img src={appleIcon} className={styles.oauthIcon} />}
          </div>
          <div className={styles.poweredBy}><span>Powered by</span><img src={turnkeyIcon} /></div>
        </div>
      ) : (
        <div className={styles.authCard}>
          <h2>{otpId ? "Enter verification code" : "Log in or sign up"}</h2>
          <div className={styles.authForm}>
            {!otpId && configOrder
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
                  {step === "otpEmail" ? email : formatPhoneNumber(phone)}
                </div>
              </span>
              <OtpInput
                ref={otpInputRef}
                onComplete={handleValidateOtp}
                hasError={!!otpError}
              />
            </div>
                      <div className={styles.errorText}>{otpError ? otpError : " "}</div>
                      </div>
          )}

              {!otpId ?
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
                        </div> :
                                    <div className={styles.resendCode}>
                                    <span>
                                      <span
                                        onClick={
                                          resendText === "Re-send Code" ? handleResendCode : undefined
                                        }
                                        style={{
                                          cursor:
                                            resendText === "Re-send Code" ? "pointer" : "not-allowed",
                                        }}
                                        className={styles.resendCodeBold}
                                      >
                                        {resendText}
                                      </span>
                                    </span>
                                  </div>
              }
            
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
    </div>} </>
  );
};

export default Auth;