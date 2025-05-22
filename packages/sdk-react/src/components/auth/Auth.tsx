"use client";

import styles from "./Auth.module.css";
import React, { useEffect, useState } from "react";
import { MuiPhone } from "./PhoneInput";
import GoogleAuthButton from "./Google";
import AppleAuthButton from "./Apple";
import FacebookAuthButton from "./Facebook";
import { CircularProgress, TextField } from "@mui/material";
import turnkeyIcon from "assets/turnkey.svg";
import googleIcon from "assets/google.svg";
import facebookIcon from "assets/facebook.svg";
import appleIcon from "assets/apple.svg";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import OtpVerification from "./OtpVerification";
import { useTurnkey } from "../../hooks/use-turnkey";
import { FilterType, OtpType, authErrors } from "./constants";
import type { TurnkeyApiTypes, WalletAccount } from "@turnkey/sdk-browser";
import { server } from "@turnkey/sdk-server";
import parsePhoneNumberFromString from "libphonenumber-js";

export enum SessionType {
  READ_ONLY = "SESSION_TYPE_READ_ONLY",
  READ_WRITE = "SESSION_TYPE_READ_WRITE",
}
export interface PasskeyConfig {
  displayName?: string;
  name?: string;
}

export interface OtpConfig {
  otpLength?: number;
  alphanumeric?: boolean;
}

const passkeyIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="43" height="48" fill="none">
    <path
      fill="var(--icon-color)"
      fillRule="evenodd"
      d="M27.52 37.06a6.8 6.8 0 0 0-2.02-.31H12a6.75 6.75 0 0 0-6.75 6.75V48H.75v-4.5A11.25 11.25 0 0 1 12 32.25h13.5c.68 0 1.355.062 2.016.182zm4.698-23.74a13.5 13.5 0 1 0-8.503 13.484c-.057-.178-.131-.425-.167-.566a13 13 0 0 1-.229-1.134 12 12 0 0 1-.054-.448q-.02-.202-.013-1.064c.007-.82.01-.877.055-1.186.018-.121.046-.29.072-.438a9 9 0 1 1 4.315-6.714 13.83 13.83 0 0 1 .87-.564 14 14 0 0 1 1.08-.556c.102-.045.299-.128.44-.184.14-.056.384-.146.544-.202.16-.055.436-.141.615-.194.18-.05.467-.125.641-.165.092-.02.214-.046.334-.07"
      clipRule="evenodd"
    />
    <path
      fill="var(--icon-color)"
      fillRule="evenodd"
      d="M33.844 16.554a9.563 9.563 0 0 0-.975.134c-.125.022-.355.075-.51.114s-.418.12-.589.177a11 11 0 0 0-.553.21 12 12 0 0 0-.519.244 8.29 8.29 0 0 0-.961.573c-.114.08-.313.23-.445.334-.13.104-.358.31-.507.454a10 10 0 0 0-.466.495c-.107.127-.269.334-.362.46-.091.128-.232.34-.313.474-.079.133-.195.34-.256.46-.062.122-.15.308-.196.413a10 10 0 0 0-.152.387c-.04.107-.1.304-.14.44a9 9 0 0 0-.119.51c-.028.145-.065.374-.082.51a6 6 0 0 0-.032.773c-.002.327.007.598.021.712a8.924 8.924 0 0 0 .163.905c.03.116.09.322.134.457.046.136.125.35.178.475a8 8 0 0 0 .725 1.329 9.15 9.15 0 0 0 .622.772c.111.121.294.306.408.41.114.101.295.256.4.342.108.085.273.211.37.28.097.068.244.165.325.218l.299.179c.082.047.251.137.374.2.125.062.232.127.24.146.013.025.018 2.403.018 7.032 0 5.905.004 7.018.025 7.125.014.07.047.18.075.24.029.064.08.156.113.203.032.05.522.654 1.086 1.345.564.693 1.07 1.31 1.123 1.371.054.063.14.151.195.195.054.042.162.111.239.151s.204.092.281.115c.121.035.181.04.413.04.206 0 .3-.007.387-.03a2 2 0 0 0 .237-.09 1.8 1.8 0 0 0 .388-.25c.029-.029.547-.657 1.153-1.397a97 97 0 0 0 1.12-1.383.4.4 0 0 0 .019-.137c0-.053-.016-.178-.035-.276a5 5 0 0 0-.273-.876 24 24 0 0 0-.298-.73 32 32 0 0 0-.626-1.365.8.8 0 0 1-.069-.172q.001-.033.041-.043c.021-.003.134-.016.25-.026s.295-.032.395-.046c.102-.016.248-.044.325-.065a.9.9 0 0 0 .237-.102.8.8 0 0 0 .15-.133c.028-.037.073-.116.1-.174.026-.058.054-.16.065-.229a1.895 1.895 0 0 0-.042-.589 2 2 0 0 0-.074-.193c-.023-.053-.355-.542-.736-1.085-.38-.543-.693-1.005-.693-1.025 0-.028.037-.046.234-.105.128-.04.339-.113.469-.162.132-.047.293-.116.36-.15a1 1 0 0 0 .204-.144.8.8 0 0 0 .144-.212c.034-.072.072-.18.085-.238s.024-.2.024-.316c0-.123-.009-.25-.024-.308a1.4 1.4 0 0 0-.072-.202c-.032-.07-.275-.39-.737-.975-.378-.479-.687-.883-.687-.9s.018-.043.04-.055.197-.11.39-.215c.194-.103.431-.237.528-.295.096-.058.22-.15.274-.204a1.1 1.1 0 0 0 .257-.459c.026-.1.031-.247.04-1.283.005-.642.016-1.178.023-1.19s.105-.069.22-.125c.112-.058.284-.15.38-.204a10 10 0 0 0 .985-.668 6.762 6.762 0 0 0 .826-.767c.107-.117.267-.305.358-.418a8 8 0 0 0 .605-.891 8.9 8.9 0 0 0 .373-.756c.045-.105.12-.308.17-.448a8 8 0 0 0 .156-.536c.037-.155.088-.408.113-.563.023-.155.05-.381.061-.505a8 8 0 0 0-.007-1.139 8 8 0 0 0-.07-.527 8 8 0 0 0-.097-.466c-.028-.116-.08-.3-.116-.413a7 7 0 0 0-.83-1.714 10 10 0 0 0-.256-.37 9 9 0 0 0-.23-.29 9 9 0 0 0-.81-.82 9 9 0 0 0-.395-.32 9 9 0 0 0-.835-.556 13 13 0 0 0-.417-.221 11 11 0 0 0-.483-.223 8 8 0 0 0-.98-.343 11 11 0 0 0-.422-.108c-.106-.022-.288-.06-.404-.079a10 10 0 0 0-.51-.073 8 8 0 0 0-.852-.043c-.304-.001-.644.002-.756.011m.207 3.334-.058.006a4.6 4.6 0 0 0-1.283.341 4 4 0 0 0-.334.159 4.354 4.354 0 0 0-.668.452 5.5 5.5 0 0 0-.669.69 5 5 0 0 0-.207.308 4 4 0 0 0-.18.325c-.04.088-.101.234-.135.325a3.856 3.856 0 0 0-.177.66c-.016.087-.034.24-.04.342-.01.159-.008.19.017.215.028.03.25.031 4.175.031 3.663 0 4.15-.003 4.174-.026q.029-.027.028-.12a3 3 0 0 0-.072-.574 3.9 3.9 0 0 0-.297-.87 4 4 0 0 0-.21-.379 6 6 0 0 0-.23-.316 6 6 0 0 0-.346-.37 5 5 0 0 0-.365-.326 7 7 0 0 0-.246-.178 5 5 0 0 0-.264-.16 4.6 4.6 0 0 0-1.585-.52 5.681 5.681 0 0 0-.84-.035z"
      clipRule="evenodd"
    />
  </svg>
);

const passkeyIconError = (
  <svg xmlns="http://www.w3.org/2000/svg" width="43" height="48" fill="none">
    <path
      fill="var(--error-color)"
      fillRule="evenodd"
      d="M27.52 37.06a6.8 6.8 0 0 0-2.02-.31H12a6.75 6.75 0 0 0-6.75 6.75V48H.75v-4.5A11.25 11.25 0 0 1 12 32.25h13.5c.68 0 1.355.062 2.016.182zm4.698-23.74a13.5 13.5 0 1 0-8.503 13.484c-.057-.178-.131-.425-.167-.566a13 13 0 0 1-.229-1.134 12 12 0 0 1-.054-.448q-.02-.202-.013-1.064c.007-.82.01-.877.055-1.186.018-.121.046-.29.072-.438a9 9 0 1 1 4.315-6.714 13.83 13.83 0 0 1 .87-.564 14 14 0 0 1 1.08-.556c.102-.045.299-.128.44-.184.14-.056.384-.146.544-.202.16-.055.436-.141.615-.194.18-.05.467-.125.641-.165.092-.02.214-.046.334-.07"
      clipRule="evenodd"
    />
    <path
      fill="var(--error-color)"
      fillRule="evenodd"
      d="M33.844 16.554a9.563 9.563 0 0 0-.975.134c-.125.022-.355.075-.51.114s-.418.12-.589.177a11 11 0 0 0-.553.21 12 12 0 0 0-.519.244 8.29 8.29 0 0 0-.961.573c-.114.08-.313.23-.445.334-.13.104-.358.31-.507.454a10 10 0 0 0-.466.495c-.107.127-.269.334-.362.46-.091.128-.232.34-.313.474-.079.133-.195.34-.256.46-.062.122-.15.308-.196.413a10 10 0 0 0-.152.387c-.04.107-.1.304-.14.44a9 9 0 0 0-.119.51c-.028.145-.065.374-.082.51a6 6 0 0 0-.032.773c-.002.327.007.598.021.712a8.924 8.924 0 0 0 .163.905c.03.116.09.322.134.457.046.136.125.35.178.475a8 8 0 0 0 .725 1.329 9.15 9.15 0 0 0 .622.772c.111.121.294.306.408.41.114.101.295.256.4.342.108.085.273.211.37.28.097.068.244.165.325.218l.299.179c.082.047.251.137.374.2.125.062.232.127.24.146.013.025.018 2.403.018 7.032 0 5.905.004 7.018.025 7.125.014.07.047.18.075.24.029.064.08.156.113.203.032.05.522.654 1.086 1.345.564.693 1.07 1.31 1.123 1.371.054.063.14.151.195.195.054.042.162.111.239.151s.204.092.281.115c.121.035.181.04.413.04.206 0 .3-.007.387-.03a2 2 0 0 0 .237-.09 1.8 1.8 0 0 0 .388-.25c.029-.029.547-.657 1.153-1.397a97 97 0 0 0 1.12-1.383.4.4 0 0 0 .019-.137c0-.053-.016-.178-.035-.276a5 5 0 0 0-.273-.876 24 24 0 0 0-.298-.73 32 32 0 0 0-.626-1.365.8.8 0 0 1-.069-.172q.001-.033.041-.043c.021-.003.134-.016.25-.026s.295-.032.395-.046c.102-.016.248-.044.325-.065a.9.9 0 0 0 .237-.102.8.8 0 0 0 .15-.133c.028-.037.073-.116.1-.174.026-.058.054-.16.065-.229a1.895 1.895 0 0 0-.042-.589 2 2 0 0 0-.074-.193c-.023-.053-.355-.542-.736-1.085-.38-.543-.693-1.005-.693-1.025 0-.028.037-.046.234-.105.128-.04.339-.113.469-.162.132-.047.293-.116.36-.15a1 1 0 0 0 .204-.144.8.8 0 0 0 .144-.212c.034-.072.072-.18.085-.238s.024-.2.024-.316c0-.123-.009-.25-.024-.308a1.4 1.4 0 0 0-.072-.202c-.032-.07-.275-.39-.737-.975-.378-.479-.687-.883-.687-.9s.018-.043.04-.055.197-.11.39-.215c.194-.103.431-.237.528-.295.096-.058.22-.15.274-.204a1.1 1.1 0 0 0 .257-.459c.026-.1.031-.247.04-1.283.005-.642.016-1.178.023-1.19s.105-.069.22-.125c.112-.058.284-.15.38-.204a10 10 0 0 0 .985-.668 6.762 6.762 0 0 0 .826-.767c.107-.117.267-.305.358-.418a8 8 0 0 0 .605-.891 8.9 8.9 0 0 0 .373-.756c.045-.105.12-.308.17-.448a8 8 0 0 0 .156-.536c.037-.155.088-.408.113-.563.023-.155.05-.381.061-.505a8 8 0 0 0-.007-1.139 8 8 0 0 0-.07-.527 8 8 0 0 0-.097-.466c-.028-.116-.08-.3-.116-.413a7 7 0 0 0-.83-1.714 10 10 0 0 0-.256-.37 9 9 0 0 0-.23-.29 9 9 0 0 0-.81-.82 9 9 0 0 0-.395-.32 9 9 0 0 0-.835-.556 13 13 0 0 0-.417-.221 11 11 0 0 0-.483-.223 8 8 0 0 0-.98-.343 11 11 0 0 0-.422-.108c-.106-.022-.288-.06-.404-.079a10 10 0 0 0-.51-.073 8 8 0 0 0-.852-.043c-.304-.001-.644.002-.756.011m.207 3.334-.058.006a4.6 4.6 0 0 0-1.283.341 4 4 0 0 0-.334.159 4.354 4.354 0 0 0-.668.452 5.5 5.5 0 0 0-.669.69 5 5 0 0 0-.207.308 4 4 0 0 0-.18.325c-.04.088-.101.234-.135.325a3.856 3.856 0 0 0-.177.66c-.016.087-.034.24-.04.342-.01.159-.008.19.017.215.028.03.25.031 4.175.031 3.663 0 4.15-.003 4.174-.026q.029-.027.028-.12a3 3 0 0 0-.072-.574 3.9 3.9 0 0 0-.297-.87 4 4 0 0 0-.21-.379 6 6 0 0 0-.23-.316 6 6 0 0 0-.346-.37 5 5 0 0 0-.365-.326 7 7 0 0 0-.246-.178 5 5 0 0 0-.264-.16 4.6 4.6 0 0 0-1.585-.52 5.681 5.681 0 0 0-.84-.035z"
      clipRule="evenodd"
    />
  </svg>
);

interface AuthProps {
  onAuthSuccess: () => Promise<void>;
  onError: (errorMessage: string) => void;
  authConfig: {
    emailEnabled: boolean;
    passkeyEnabled: boolean;
    phoneEnabled: boolean;
    appleEnabled: boolean;
    facebookEnabled: boolean;
    googleEnabled: boolean;
    walletEnabled: boolean;
    openOAuthInPage?: boolean;
    sessionLengthSeconds?: number; // Desired expiration time in seconds for the generated API key
    googleClientId?: string; // will default to NEXT_PUBLIC_GOOGLE_CLIENT_ID
    appleClientId?: string; // will default to NEXT_PUBLIC_APPLE_CLIENT_ID
    facebookClientId?: string; // will default to NEXT_PUBLIC_FACEBOOK_CLIENT_ID
  };
  configOrder: string[];
  emailCustomization?: TurnkeyApiTypes["v1EmailCustomizationParams"];
  sendFromEmailAddress?: string;
  customSmsMessage?: string;
  customAccounts?: WalletAccount[];
  passkeyConfig?: PasskeyConfig;
  otpConfig?: OtpConfig;
}

const Auth: React.FC<AuthProps> = ({
  onAuthSuccess,
  onError,
  authConfig,
  configOrder,
  emailCustomization,
  sendFromEmailAddress,
  customSmsMessage,
  customAccounts,
  passkeyConfig,
  otpConfig,
}) => {
  const { passkeyClient, walletClient, indexedDbClient, turnkey } =
    useTurnkey();
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [step, setStep] = useState<string>("auth");
  const [loading, setLoading] = useState<string | undefined>();
  const [oauthLoading, setOauthLoading] = useState<string>("");
  const [passkeySignupScreen, setPasskeySignupScreen] = useState(false);
  const [passkeyCreationScreen, setPasskeyCreationScreen] = useState(false);
  const [passkeySignupError, setPasskeySignupError] = useState("");
  const [componentReady, setComponentReady] = useState(false);
  const [passkeyCreated, setPasskeyCreated] = useState(false);

  const handleResendCode = async () => {
    if (step === OtpType.Email) {
      await handleOtpLogin(FilterType.Email, email, OtpType.Email);
    } else if (step === OtpType.Sms) {
      await handleOtpLogin(FilterType.PhoneNumber, phone, OtpType.Sms);
    }
  };

  useEffect(() => {
    const manageClient = async () => {
      if (indexedDbClient && turnkey) {
        const session = await turnkey.getSession();

        if (!session) {
          await indexedDbClient.resetKeyPair();
        }

        const retrievedPublicKey = await indexedDbClient.getPublicKey();
        if (retrievedPublicKey) {
          setComponentReady(true);
        } else {
          onError("Failed to retrieve public key.");
        }
      }
    };

    manageClient();
  }, [indexedDbClient, turnkey]);

  if (!componentReady) {
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

  const isValidPhone = (phone: string) => {
    const phoneNumber = parsePhoneNumberFromString(phone);
    return phoneNumber?.isValid() ?? false;
  };

  const handleSignupWithPasskey = async () => {
    setPasskeySignupError("");
    const siteInfo = `${
      new URL(window.location.href).hostname
    } - ${new Date().toLocaleString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
    setPasskeySignupScreen(false);
    setPasskeyCreationScreen(true);
    try {
      if (!passkeyCreated) {
        const { encodedChallenge, attestation } =
          (await passkeyClient?.createUserPasskey({
            publicKey: {
              user: {
                name: passkeyConfig?.name ?? siteInfo,
                displayName: passkeyConfig?.displayName ?? siteInfo,
              },
            },
          })) || {};

        if (encodedChallenge && attestation) {
          const response = await server.createSuborg({
            email,
            passkey: {
              authenticatorName: "First Passkey",
              challenge: encodedChallenge,
              attestation,
            },
            ...(customAccounts && { customAccounts }),
          });
          if (response?.subOrganizationId) {
            setPasskeyCreated(true);
          } else {
            authErrors.passkey.createFailed;
          }
        } else {
          authErrors.passkey.createFailed;
        }
      }

      const pubKey = await indexedDbClient!.getPublicKey();
      await passkeyClient?.loginWithPasskey({
        sessionType: SessionType.READ_WRITE,
        publicKey: pubKey!,
        expirationSeconds: authConfig.sessionLengthSeconds?.toString(),
      });

      await onAuthSuccess();
    } catch (error) {
      setPasskeySignupError(authErrors.passkey.timeoutOrNotAllowed);
      console.error("Error during passkey signup: ", error);
    }
  };

  const handleLoginWithPasskey = async () => {
    try {
      setLoading("passkey");

      const pubKey = await indexedDbClient!.getPublicKey();
      await passkeyClient?.loginWithPasskey({
        sessionType: SessionType.READ_WRITE,
        publicKey: pubKey!,
        expirationSeconds: authConfig.sessionLengthSeconds?.toString(),
      });
      await onAuthSuccess();
    } catch (error) {
      onError(authErrors.passkey.loginFailed);
      console.error("Error during passkey login: ", error);
    } finally {
      setLoading(undefined);
    }
  };

  const handleOtpLogin = async (
    type: FilterType.Email | FilterType.PhoneNumber,
    value: string,
    otpType: string,
  ) => {
    setLoading(otpType);
    const createSuborgData: Record<string, any> = {};
    if (type === FilterType.Email) {
      createSuborgData.email = value;
    } else if (type === FilterType.PhoneNumber) {
      createSuborgData.phoneNumber = value;
    }

    if (customAccounts) {
      createSuborgData.customAccounts = customAccounts;
    }

    const publicKey = await indexedDbClient!.getPublicKey();
    const initAuthResponse = await server.sendOtp({
      otpType,
      contact: value,
      ...(emailCustomization && { emailCustomization }),
      ...(sendFromEmailAddress && { sendFromEmailAddress }),
      ...(customSmsMessage && { customSmsMessage }),
      otpLength: otpConfig?.otpLength ?? 6,
      alphanumeric: otpConfig?.alphanumeric ?? false,
      userIdentifier: publicKey!,
    });
    if (initAuthResponse && initAuthResponse.otpId) {
      setOtpId(initAuthResponse?.otpId!);
      setStep(otpType);
    } else {
      onError(authErrors.otp.sendFailed);
    }
    setLoading(undefined);
  };

  const handleOAuthLogin = async (credential: string, providerName: string) => {
    const pubKey = await indexedDbClient?.getPublicKey();
    console.log("Public key: ", pubKey);
    if (!pubKey) {
      return;
    }
    setOauthLoading(providerName);
    const createSuborgData: Record<string, any> = {
      oauthProviders: [{ providerName, oidcToken: credential }],
    };
    if (customAccounts) {
      createSuborgData.customAccounts = customAccounts;
    }

    const resp = await server.getOrCreateSuborg({
      filterType: FilterType.OidcToken,
      filterValue: credential,
      additionalData: createSuborgData,
    });

    const suborgIds = resp?.subOrganizationIds;
    if (!suborgIds || suborgIds.length === 0) {
      onError(authErrors.oauth.loginFailed);
      return;
    }
    const suborgId = suborgIds[0];
    const sessionResponse = await server.oauthLogin({
      suborgID: suborgId!,
      oidcToken: credential,
      publicKey: pubKey!,
      sessionLengthSeconds: authConfig.sessionLengthSeconds,
    });
    if (sessionResponse && sessionResponse.session) {
      await indexedDbClient!.loginWithSession(sessionResponse.session);
      await onAuthSuccess();
    } else {
      onError(authErrors.oauth.loginFailed);
    }
  };

  const handleLoginWithWallet = async () => {
    setLoading("wallet");
    try {
      if (!walletClient) {
        throw new Error("Wallet client not initialized");
      }

      const publicKey = await walletClient.getPublicKey();
      if (!publicKey) {
        throw new Error(authErrors.wallet.noPublicKey);
      }

      const { type } = walletClient.getWalletInterface();

      const resp = await server.getOrCreateSuborg({
        filterType: FilterType.PublicKey,
        filterValue: publicKey,
        additionalData: {
          wallet: {
            publicKey,
            type,
          },
        },
      });

      const suborgIds = resp?.subOrganizationIds;
      if (!suborgIds || suborgIds.length === 0) {
        onError(authErrors.wallet.loginFailed);
        return;
      }

      const pubKey = await indexedDbClient!.getPublicKey();
      await walletClient!.loginWithWallet({
        sessionType: SessionType.READ_WRITE,
        publicKey: pubKey!,
        expirationSeconds: authConfig.sessionLengthSeconds?.toString(),
      });
      await onAuthSuccess();
    } catch (error: any) {
      onError(error.message || authErrors.wallet.loginFailed);
      console.error("Error during wallet login: ", error);
    } finally {
      setLoading(undefined);
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
        fontSize: "24px",
        top: 16,
        left: 16,
        zIndex: 10,
        cursor: "pointer",
        borderRadius: "50%",
        padding: "6px",
        transition: "background-color 0.3s ease",
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
            clientId={
              authConfig.googleClientId ??
              process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
            }
            openInPage={authConfig.openOAuthInPage}
            onSuccess={(response: any) =>
              handleOAuthLogin(response.idToken, "Google")
            }
          />
        )}
        {appleEnabled && (
          <AppleAuthButton
            layout={layout}
            clientId={
              authConfig.appleClientId ??
              process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!
            }
            openInPage={authConfig.openOAuthInPage}
            onSuccess={(response: any) =>
              handleOAuthLogin(response.idToken, "Apple")
            }
          />
        )}
        {facebookEnabled && (
          <FacebookAuthButton
            layout={layout}
            clientId={
              authConfig.facebookClientId ??
              process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID!
            }
            openInPage={authConfig.openOAuthInPage}
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleOtpLogin(FilterType.Email, email, OtpType.Email);
            }}
          >
            <div className={styles.inputGroup}>
              <TextField
                name="email-input"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "var(--input-text)",
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
              type="submit"
              disabled={!isValidEmail(email) || loading === OtpType.Email}
            >
              {loading === OtpType.Email ? (
                <CircularProgress
                  size={24}
                  thickness={4}
                  className={styles.buttonProgress || ""}
                />
              ) : (
                "Continue"
              )}
            </button>
          </form>
        ) : null;

      case "phone":
        return authConfig.phoneEnabled && !otpId ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleOtpLogin(FilterType.PhoneNumber, phone, OtpType.Sms);
            }}
          >
            <div className={styles.phoneInput}>
              <MuiPhone onChange={(value) => setPhone(value)} value={phone} />
            </div>
            <button
              className={styles.authButton}
              type="submit"
              disabled={!isValidPhone(phone) || loading === OtpType.Sms}
            >
              {loading === OtpType.Sms ? (
                <CircularProgress
                  size={24}
                  thickness={4}
                  className={styles.buttonProgress || ""}
                />
              ) : (
                "Continue"
              )}
            </button>
          </form>
        ) : null;

      case "passkey":
        return authConfig.passkeyEnabled && !otpId ? (
          <div className={styles.passkeyContainer}>
            <button
              className={styles.authButton}
              type="button"
              onClick={handleLoginWithPasskey}
              disabled={loading === "passkey"}
            >
              {loading === "passkey" ? (
                <CircularProgress
                  size={24}
                  thickness={4}
                  className={styles.buttonProgress || ""}
                />
              ) : (
                "Log in with passkey"
              )}
            </button>
            <div
              className={styles.noPasskeyLink}
              onClick={() => setPasskeySignupScreen(true)}
            >
              Sign up with passkey
            </div>
          </div>
        ) : null;

      case "wallet":
        return authConfig.walletEnabled && !otpId ? (
          <div className={styles.passkeyContainer}>
            <button
              className={styles.authButton}
              type="button"
              onClick={handleLoginWithWallet}
              disabled={loading === "wallet"}
            >
              {loading === "wallet" ? (
                <CircularProgress
                  size={24}
                  thickness={4}
                  className={styles.buttonProgress || ""}
                />
              ) : (
                "Continue with Wallet"
              )}
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
          <div className={styles.passkeyIconContainer}>{passkeyIcon}</div>
          <center>
            <h3 className={styles.primaryText}>Create a passkey</h3>
          </center>
          <div className={styles.rowsContainer}>
            <center>
              <span className={styles.primaryText}>
                Passkeys allow for easy biometric access to your wallet and can
                be synced across devices.
              </span>
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
              <div>{passkeyIconError}</div>
            ) : (
              <div className={styles.loadingWrapper}>
                <CircularProgress
                  size={80}
                  thickness={1}
                  className={styles.circularProgress!}
                />
                {passkeyIcon}
              </div>
            )}
          </div>
          <center>
            <h3 className={styles.primaryText}>
              {passkeySignupError
                ? "Authentication error"
                : passkeyCreated
                  ? "Logging in with passkey..."
                  : "Creating passkey..."}
            </h3>
          </center>
          <div className={styles.rowsContainer}>
            <span className={styles.primaryText}>
              <center>{passkeySignupError ? passkeySignupError : ""}</center>
            </span>
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
              <h2 className={styles.primaryText}>
                {!otpId && "Log in or sign up"}
              </h2>
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
                    contact={step === OtpType.Email ? email : phone}
                    otpId={otpId!}
                    alphanumeric={otpConfig?.alphanumeric ?? false}
                    sessionLengthSeconds={authConfig.sessionLengthSeconds}
                    onValidateSuccess={onAuthSuccess}
                    onResendCode={handleResendCode}
                    numBoxes={otpConfig?.otpLength ?? 6}
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
