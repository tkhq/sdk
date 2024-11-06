import styles from "./Auth.module.css";
import { useEffect, useState } from "react";
import { useTurnkey } from "../../hooks/useTurnkey";
import {
  initOtpAuth,
  otpAuth,
  getSuborgs,
  createSuborg,
  oauth,
} from "../../actions/";
import { MuiPhone } from "./PhoneInput";
import OTPInput from "./OtpInput";
import GoogleAuthButton from "./Google";
import AppleAuthButton from "./Apple";
import FacebookAuthButton from "./Facebook";
import { CircularProgress } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import FacebookIcon from "@mui/icons-material/Facebook";
import AppleIcon from "@mui/icons-material/Apple";

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
}

const Auth: React.FC<AuthProps> = ({ onHandleAuthSuccess, authConfig }) => {
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

  useEffect(() => {
    if (error) {
      alert(error);
    }
  }, [error]);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidPhone = (phone: string) => {
    const usCanadaRegex = /^\+1\d{10}$/;
    return usCanadaRegex.test(phone);
  };

  const handleGetOrCreateSuborg = async (
    filterType: string,
    filterValue: string,
    additionalData = {}
  ) => {
    const getSuborgsResponse = await getSuborgs({ filterType, filterValue });
    let suborgId = getSuborgsResponse!.organizationIds[0];
    
    if (!suborgId) {
      const createSuborgData: Record<string, any> = {
        ...additionalData,
      };
  
      if (filterType === "EMAIL") {
        createSuborgData.email = filterValue;
      } else if (filterType === "PHONE_NUMBER") {
        createSuborgData.phoneNumber = filterValue;
      }
  
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

  const handleLoginWithPasskey = async () => {
    // Step 1: Try to retrieve the suborg by email
    const getSuborgsResponse = await getSuborgs({
      filterType: "EMAIL",
      filterValue: email,
    });
    const existingSuborgId = getSuborgsResponse!.organizationIds[0];

    if (existingSuborgId) {
      // If a suborg exists, use it to create a read/write session without a new passkey
      const sessionResponse = await passkeyClient?.createReadWriteSession({
        organizationId: existingSuborgId,
        targetPublicKey: authIframeClient?.iframePublicKey!,
      });

      if (sessionResponse?.credentialBundle) {
        await handleAuthSuccess(sessionResponse.credentialBundle);
      } else {
        setError("Failed to complete passkey login.");
      }
    } else {
      // If no suborg exists, first create a user passkey
      const { encodedChallenge, attestation } =
        (await passkeyClient?.createUserPasskey({
          publicKey: { user: { name: email, displayName: email } },
        })) || {};

      if (encodedChallenge && attestation) {
        // Use the generated passkey to create a new suborg
        const createSuborgResponse = await createSuborg({
          email,
          passkey: {
            authenticatorName: "First Passkey",
            challenge: encodedChallenge,
            attestation,
          },
        });

        const newSuborgId = createSuborgResponse?.subOrganizationId;

        if (newSuborgId) {
          // With the new suborg, create a read/write session
          const newSessionResponse =
            await passkeyClient?.createReadWriteSession({
              organizationId: newSuborgId,
              targetPublicKey: authIframeClient?.iframePublicKey!,
            });

          if (newSessionResponse?.credentialBundle) {
            await handleAuthSuccess(newSessionResponse.credentialBundle);
          } else {
            setError("Failed to complete passkey login with new suborg.");
          }
        } else {
          setError("Failed to create suborg with passkey.");
        }
      } else {
        setError("Failed to create user passkey.");
      }
    }
  };

  const handleOtpLogin = async (
    type: "EMAIL" | "PHONE_NUMBER",
    value: string,
    otpType: string
  ) => {
    const suborgId = await handleGetOrCreateSuborg(type, value);
    console.log(suborgId)
    const initAuthResponse = await initOtpAuth({
      suborgID: suborgId,
      otpType,
      contact: value,
    });
    setSuborgId(suborgId);
    setOtpId(initAuthResponse!.otpId);
    setStep(type === "EMAIL" ? "otpEmail" : "otpPhone");
  };

  const handleValidateOtp = async (otp: string) => {
    const authResponse = await otpAuth({
      suborgID: suborgId,
      otpId: otpId!,
      otpCode: otp,
      targetPublicKey: authIframeClient!.iframePublicKey!,
    });
    authResponse?.credentialBundle
      ? await handleAuthSuccess(authResponse.credentialBundle)
      : setOtpError("Invalid code, please try again");
  };

  const handleGoogleLogin = async (response: any) => {
    const credential = response.credential;
    setOauthLoading("Google");
    await handleOAuthLogin(credential, "Google OIDC");
  };

  const handleAppleLogin = async (response: any) => {
    const appleToken = response.authorization?.id_token;
    setOauthLoading("Apple");
    if (appleToken) {
      await handleOAuthLogin(appleToken, "Apple OIDC");
    }
  };

  const handleFacebookLogin = async (response: any) => {
    const facebookToken = response?.id_token;
    setOauthLoading("Facebook");
    if (facebookToken) {
      await handleOAuthLogin(facebookToken, "Facebook OIDC");
    } else {
      setError("Facebook login failed: No token returned.");
    }
  };

  const handleOAuthLogin = async (credential: string, providerName: string) => {
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

  const handleResendCode = async () => {
    setOtpError(null);
    if (step === "otpEmail") {
      await handleOtpLogin("EMAIL", email, "OTP_TYPE_EMAIL");
    } else if (step === "otpPhone") {
      await handleOtpLogin("PHONE_NUMBER", phone, "OTP_TYPE_SMS");
    }
    setResendText("Code Sent ✓");
  };

  return (
    <div>
      {oauthLoading != "" ? (
        <div className={styles.authCardLoading}>
          <h3 className={styles.verifyingText}>
            Verifying with {oauthLoading}
          </h3>
          <div className={styles.loadingWrapper}>
            <CircularProgress
              size={100}
              thickness={1}
              className={styles.circularProgress}
            />
            {oauthLoading === "Google" && (
              <GoogleIcon className={styles.oauthIcon} />
            )}
            {oauthLoading === "Facebook" && (
              <FacebookIcon className={styles.oauthIcon} />
            )}
            {oauthLoading === "Apple" && (
              <AppleIcon className={styles.oauthIcon} />
            )}
          </div>
          <div className={styles.poweredBy}>
            <span>Powered by</span>
            <svg
              width="60"
              height="11"
              viewBox="0 0 60 11"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <svg
                width="60"
                height="11"
                viewBox="0 0 60 11"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clip-path="url(#clip0_216_22334)">
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M36.6054 0.458008H36.713H37.8391H37.9468V0.559475V5.93186V7.21982V8.81084V8.91233H37.8391H36.713H36.6054V8.81084V0.559475V0.458008ZM14.716 7.76302V3.3255H16.1437V2.17215H14.5996C14.6906 2.06524 14.7632 1.94566 14.8151 1.81769C14.912 1.58567 14.9637 1.28871 14.9588 0.889603V0.458036H13.6661V0.904484C13.6747 1.15788 13.6203 1.40966 13.5074 1.63979C13.3386 1.96583 12.9788 2.32638 12.1968 2.49955L12.1135 2.51849V3.3255H13.3616V8.06607C13.3624 8.29033 13.4572 8.50525 13.6255 8.66394C13.7938 8.82254 14.0219 8.9121 14.26 8.91296H16.1645V7.76302H14.7168H14.716ZM25.7321 3.29168C26.2535 2.59087 26.9458 2.18094 27.7831 2.18094H28.4524V3.40668H27.6359C27.0643 3.40668 26.6046 3.58188 26.2793 3.95122C25.954 4.32056 25.7595 4.8969 25.7595 5.71743V8.91296H24.3907V2.18094H25.7321V3.29168ZM54.9349 2.18094H56.2441L56.3992 2.18568L56.3425 2.32097L52.9242 10.6684L52.8409 10.6379L52.8509 10.642L52.9227 10.6684C52.826 10.8845 52.6651 11.0696 52.4594 11.2016C52.2536 11.3336 52.0118 11.4068 51.763 11.4125H50.2477V10.2747H51.7162L52.331 8.81013L49.6517 2.31623L49.5949 2.18094H51.103L51.1289 2.24859L53.014 7.20832L54.9098 2.24859L54.9349 2.18094ZM21.6711 2.18094H21.7788H23.0255V8.91498H21.7379V8.08433C21.2295 8.75131 20.4818 9.06657 19.5663 9.06657C18.6341 9.06657 17.9971 8.80951 17.6065 8.36171C17.2158 7.91387 17.0722 7.28883 17.0722 6.57788V2.18094H18.4273V6.70166C18.4273 7.07777 18.5529 7.37879 18.7728 7.58511C18.9925 7.79142 19.3149 7.91387 19.7271 7.91387C20.3922 7.91387 20.8719 7.70619 21.19 7.36526C21.5081 7.02433 21.6711 6.53932 21.6711 5.96907V2.18094ZM46.1687 2.0294C45.1554 2.0294 44.3202 2.38115 43.74 3.00348C43.1597 3.62582 42.843 4.5052 42.843 5.55303C42.843 6.60085 43.1713 7.48633 43.7608 8.10258C44.3504 8.71886 45.1971 9.06446 46.2089 9.06446C47.0139 9.06446 47.7055 8.84665 48.2462 8.4455C48.787 8.04439 49.1697 7.46603 49.3694 6.75441L49.4053 6.62656H48.01L47.9842 6.69419C47.6768 7.49173 47.0441 7.92804 46.2089 7.92804C45.6085 7.92804 45.146 7.71564 44.8172 7.35984C44.5063 7.0216 44.3109 6.55215 44.2391 5.99678H49.4154L49.4262 5.9068C49.4378 5.78967 49.4423 5.67201 49.4398 5.55438C49.4398 4.50791 49.1367 3.62649 48.5715 3.00551C48.0064 2.38453 47.182 2.0294 46.1687 2.0294ZM44.2864 4.8326C44.382 4.35909 44.5802 3.94849 44.8739 3.65626C45.0402 3.49218 45.2411 3.36273 45.4637 3.27628C45.6864 3.18983 45.9258 3.14829 46.1666 3.15433C46.3957 3.14896 46.6234 3.18792 46.8358 3.26878C47.0484 3.34965 47.2409 3.4707 47.4018 3.62446C47.6962 3.90789 47.9044 4.31715 48.0078 4.8326H44.2864ZM32.8904 2.0294C31.9748 2.0294 31.2273 2.34462 30.7189 3.0116V2.18092H29.4312V8.91296H30.7856V5.12484C30.7856 4.55458 30.9486 4.06957 31.2668 3.72796C31.5849 3.38635 32.0646 3.18004 32.7296 3.18004C33.1418 3.18004 33.4643 3.30247 33.684 3.50879C33.9038 3.71511 34.0294 4.01612 34.0294 4.39224V8.91366H35.3845V4.51671C35.3845 3.80644 35.2409 3.18139 34.8502 2.73359C34.4596 2.28578 33.8226 2.0294 32.8904 2.0294ZM43.2475 2.19831L39.6902 5.55087L43.2451 8.90164L41.4499 8.89806L38.8528 6.45049C38.5999 6.21193 38.4577 5.88846 38.4577 5.55116C38.4577 5.21387 38.5999 4.89038 38.8528 4.65183L41.4562 2.19831H43.2475Z"
                    fill="#A2A7AE"
                  />
                  <path
                    d="M6.39906 4.34455L8.76102 9.22357H3.4917L5.85366 4.34455C5.87764 4.29535 5.91607 4.25366 5.96441 4.22444C6.01274 4.19522 6.06895 4.17969 6.12635 4.17969C6.18376 4.17969 6.23997 4.19522 6.2883 4.22444C6.33664 4.25366 6.37507 4.29535 6.39906 4.34455Z"
                    fill="#A2A7AE"
                  />
                  <path
                    d="M6.12613 3.58868C7.04256 3.58868 7.78546 2.88785 7.78546 2.02335C7.78546 1.15883 7.04256 0.458008 6.12613 0.458008C5.2097 0.458008 4.4668 1.15883 4.4668 2.02335C4.4668 2.88785 5.2097 3.58868 6.12613 3.58868Z"
                    fill="#A2A7AE"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_216_22334">
                    <rect
                      width="59"
                      height="11"
                      fill="white"
                      transform="translate(0.5)"
                    />
                  </clipPath>
                </defs>
              </svg>
            </svg>
          </div>
        </div>
      ) : (
        <div className={styles.authCard}>
          <h2>{otpId ? "Enter verification code" : "Log in or sign up"}</h2>
          <div className={styles.authForm}>
            {authConfig.emailEnabled && !otpId && (
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
                  onClick={() =>
                    handleOtpLogin("EMAIL", email, "OTP_TYPE_EMAIL")
                  }
                  disabled={!isValidEmail(email)}
                >
                  Continue with email
                </button>
              </div>
            )}

            {authConfig.passkeyEnabled && !otpId && (
              <div>
                <button
                  type="button"
                  className={styles.passkeyButton}
                  onClick={handleLoginWithPasskey}
                  disabled={!isValidEmail(email)}
                >
                  Continue with passkey
                </button>
              </div>
            )}
            {!otpId &&
              (authConfig.passkeyEnabled || authConfig.emailEnabled) &&
              (authConfig.googleEnabled ||
                authConfig.appleEnabled ||
                authConfig.facebookEnabled ||
                authConfig.phoneEnabled) && (
                <div className={styles.separator}>
                  <span>OR</span>
                </div>
              )}
            {authConfig.phoneEnabled && !otpId && (
              <div>
                <div className={styles.phoneInput}>
                  <MuiPhone
                    onChange={(value) => setPhone(value)}
                    value={phone}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleOtpLogin("PHONE_NUMBER", phone, "OTP_TYPE_SMS")
                  }
                  disabled={!isValidPhone(phone)}
                >
                  Continue with phone
                </button>
              </div>
            )}

            {otpId && (
              <div className={styles.verification}>
                <div className={styles.verificationIcon}>
                  {step === "otpEmail" ? (
                    <svg
                      width="100"
                      height="100"
                      viewBox="0 0 100 100"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M45.8906 25.6727H35.5876C35.0356 25.6727 34.5876 26.1207 34.5876 26.6727V32.4057L28.5996 35.9717C28.2966 36.1527 28.1116 36.4787 28.1116 36.8317V45.4727H17.2446C16.6926 45.4727 16.2446 45.9207 16.2446 46.4727V58.2387H18.2446V52.0367L43.5216 67.7447L68.7976 52.0367V80.4057H18.2446V61.0277H16.2446V81.4057C16.2446 81.9587 16.6926 82.4057 17.2446 82.4057H69.7976C70.3496 82.4057 70.7976 81.9587 70.7976 81.4057V47.1157L80.6636 41.2387V70.7647H73.2236V72.7647H81.6636C82.2156 72.7647 82.6636 72.3167 82.6636 71.7647V36.8317C82.6636 36.4787 82.4786 36.1527 82.1756 35.9717L76.1876 32.4057V26.6727C76.1876 26.1207 75.7396 25.6727 75.1876 25.6727H64.8836L55.8996 20.3217C55.5836 20.1337 55.1906 20.1337 54.8756 20.3217L45.8906 25.6727ZM22.1826 76.3907H34.3726V74.3907H22.1826V76.3907ZM22.1826 71.4287H29.2776V69.4287H22.1826V71.4287ZM30.1116 45.4727H37.2186L30.1116 41.2387V45.4727ZM36.5876 42.7687L41.1276 45.4727H69.6476L74.1876 42.7687V27.6727H36.5876V42.7687Z"
                        fill="black"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="71"
                      height="60"
                      viewBox="0 0 71 60"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M24.96 42.71V50.2H57.4L68.61 59.15H70.83V21.33H24.96V40.71H18.74C18.5 40.71 18.27 40.79 18.09 40.95L4.81 52.22H2.5V2H59.43V18.38H61.43V1C61.43 0.45 60.98 0 60.43 0H1.5C0.95 0 0.5 0.45 0.5 1V53.22C0.5 53.77 0.95 54.22 1.5 54.22H5.19C5.43 54.22 5.66 54.14 5.84 53.98L19.12 42.71H24.97H24.96ZM32.32 43.02H48.89V41.02H32.32V43.02ZM32.32 36.33H62.66V34.33H32.32V36.33ZM32.32 29.64H52.22V27.64H32.32V29.64Z"
                        fill="black"
                      />
                    </svg>
                  )}
                </div>

                <span>
                  We've sent a verification code to{" "}
                  <div className={styles.verificationBold}>
                    {step === "otpEmail" ? email : phone}
                  </div>
                </span>
                <OTPInput
                  onChange={() => setOtpError(null)}
                  onComplete={handleValidateOtp}
                />
              </div>
            )}
            {otpError && <div className={styles.errorText}>{otpError}</div>}
          </div>
          {!otpId &&
            (authConfig.googleEnabled ||
              authConfig.appleEnabled ||
              authConfig.facebookEnabled) &&
            authConfig.phoneEnabled && (
              <div className={styles.separator}>
                <span>OR</span>
              </div>
            )}

          {!otpId && authConfig.googleEnabled && authIframeClient && (
            <div className={styles.authButton}>
              <div className={styles.socialButtonContainer}>
                <GoogleAuthButton
                  clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
                  iframePublicKey={authIframeClient.iframePublicKey!}
                  onSuccess={handleGoogleLogin}
                />
              </div>
            </div>
          )}

          {!otpId && authConfig.appleEnabled && authIframeClient && (
            <div className={styles.authButton}>
              <div className={styles.socialButtonContainer}>
                <AppleAuthButton
                  clientId={process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!}
                  iframePublicKey={authIframeClient.iframePublicKey!}
                  onSuccess={handleAppleLogin}
                />
              </div>
            </div>
          )}

          {!otpId && authConfig.facebookEnabled && authIframeClient && (
            <div className={styles.authButton}>
              <div className={styles.socialButtonContainer}>
                <FacebookAuthButton
                  clientId={process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID!}
                  iframePublicKey={authIframeClient.iframePublicKey!}
                  onSuccess={handleFacebookLogin}
                />
              </div>
            </div>
          )}

          <div className={styles.tos}>
            {!otpId ? (
              <span>
                By logging in you agree to our{" "}
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
            ) : (
              <span>
                Did not receive your code?{" "}
                <span
                  onClick={
                    resendText === "Re-send Code" ? handleResendCode : undefined
                  }
                  style={{
                    cursor:
                      resendText === "Re-send Code" ? "pointer" : "not-allowed",
                  }}
                  className={styles.tosBold}
                >
                  {resendText}
                </span>
              </span>
            )}
          </div>

          <div className={styles.poweredBy}>
            <span>Powered by</span>
            <svg
              width="60"
              height="11"
              viewBox="0 0 60 11"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <svg
                width="60"
                height="11"
                viewBox="0 0 60 11"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clip-path="url(#clip0_216_22334)">
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M36.6054 0.458008H36.713H37.8391H37.9468V0.559475V5.93186V7.21982V8.81084V8.91233H37.8391H36.713H36.6054V8.81084V0.559475V0.458008ZM14.716 7.76302V3.3255H16.1437V2.17215H14.5996C14.6906 2.06524 14.7632 1.94566 14.8151 1.81769C14.912 1.58567 14.9637 1.28871 14.9588 0.889603V0.458036H13.6661V0.904484C13.6747 1.15788 13.6203 1.40966 13.5074 1.63979C13.3386 1.96583 12.9788 2.32638 12.1968 2.49955L12.1135 2.51849V3.3255H13.3616V8.06607C13.3624 8.29033 13.4572 8.50525 13.6255 8.66394C13.7938 8.82254 14.0219 8.9121 14.26 8.91296H16.1645V7.76302H14.7168H14.716ZM25.7321 3.29168C26.2535 2.59087 26.9458 2.18094 27.7831 2.18094H28.4524V3.40668H27.6359C27.0643 3.40668 26.6046 3.58188 26.2793 3.95122C25.954 4.32056 25.7595 4.8969 25.7595 5.71743V8.91296H24.3907V2.18094H25.7321V3.29168ZM54.9349 2.18094H56.2441L56.3992 2.18568L56.3425 2.32097L52.9242 10.6684L52.8409 10.6379L52.8509 10.642L52.9227 10.6684C52.826 10.8845 52.6651 11.0696 52.4594 11.2016C52.2536 11.3336 52.0118 11.4068 51.763 11.4125H50.2477V10.2747H51.7162L52.331 8.81013L49.6517 2.31623L49.5949 2.18094H51.103L51.1289 2.24859L53.014 7.20832L54.9098 2.24859L54.9349 2.18094ZM21.6711 2.18094H21.7788H23.0255V8.91498H21.7379V8.08433C21.2295 8.75131 20.4818 9.06657 19.5663 9.06657C18.6341 9.06657 17.9971 8.80951 17.6065 8.36171C17.2158 7.91387 17.0722 7.28883 17.0722 6.57788V2.18094H18.4273V6.70166C18.4273 7.07777 18.5529 7.37879 18.7728 7.58511C18.9925 7.79142 19.3149 7.91387 19.7271 7.91387C20.3922 7.91387 20.8719 7.70619 21.19 7.36526C21.5081 7.02433 21.6711 6.53932 21.6711 5.96907V2.18094ZM46.1687 2.0294C45.1554 2.0294 44.3202 2.38115 43.74 3.00348C43.1597 3.62582 42.843 4.5052 42.843 5.55303C42.843 6.60085 43.1713 7.48633 43.7608 8.10258C44.3504 8.71886 45.1971 9.06446 46.2089 9.06446C47.0139 9.06446 47.7055 8.84665 48.2462 8.4455C48.787 8.04439 49.1697 7.46603 49.3694 6.75441L49.4053 6.62656H48.01L47.9842 6.69419C47.6768 7.49173 47.0441 7.92804 46.2089 7.92804C45.6085 7.92804 45.146 7.71564 44.8172 7.35984C44.5063 7.0216 44.3109 6.55215 44.2391 5.99678H49.4154L49.4262 5.9068C49.4378 5.78967 49.4423 5.67201 49.4398 5.55438C49.4398 4.50791 49.1367 3.62649 48.5715 3.00551C48.0064 2.38453 47.182 2.0294 46.1687 2.0294ZM44.2864 4.8326C44.382 4.35909 44.5802 3.94849 44.8739 3.65626C45.0402 3.49218 45.2411 3.36273 45.4637 3.27628C45.6864 3.18983 45.9258 3.14829 46.1666 3.15433C46.3957 3.14896 46.6234 3.18792 46.8358 3.26878C47.0484 3.34965 47.2409 3.4707 47.4018 3.62446C47.6962 3.90789 47.9044 4.31715 48.0078 4.8326H44.2864ZM32.8904 2.0294C31.9748 2.0294 31.2273 2.34462 30.7189 3.0116V2.18092H29.4312V8.91296H30.7856V5.12484C30.7856 4.55458 30.9486 4.06957 31.2668 3.72796C31.5849 3.38635 32.0646 3.18004 32.7296 3.18004C33.1418 3.18004 33.4643 3.30247 33.684 3.50879C33.9038 3.71511 34.0294 4.01612 34.0294 4.39224V8.91366H35.3845V4.51671C35.3845 3.80644 35.2409 3.18139 34.8502 2.73359C34.4596 2.28578 33.8226 2.0294 32.8904 2.0294ZM43.2475 2.19831L39.6902 5.55087L43.2451 8.90164L41.4499 8.89806L38.8528 6.45049C38.5999 6.21193 38.4577 5.88846 38.4577 5.55116C38.4577 5.21387 38.5999 4.89038 38.8528 4.65183L41.4562 2.19831H43.2475Z"
                    fill="#A2A7AE"
                  />
                  <path
                    d="M6.39906 4.34455L8.76102 9.22357H3.4917L5.85366 4.34455C5.87764 4.29535 5.91607 4.25366 5.96441 4.22444C6.01274 4.19522 6.06895 4.17969 6.12635 4.17969C6.18376 4.17969 6.23997 4.19522 6.2883 4.22444C6.33664 4.25366 6.37507 4.29535 6.39906 4.34455Z"
                    fill="#A2A7AE"
                  />
                  <path
                    d="M6.12613 3.58868C7.04256 3.58868 7.78546 2.88785 7.78546 2.02335C7.78546 1.15883 7.04256 0.458008 6.12613 0.458008C5.2097 0.458008 4.4668 1.15883 4.4668 2.02335C4.4668 2.88785 5.2097 3.58868 6.12613 3.58868Z"
                    fill="#A2A7AE"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_216_22334">
                    <rect
                      width="59"
                      height="11"
                      fill="white"
                      transform="translate(0.5)"
                    />
                  </clipPath>
                </defs>
              </svg>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;
