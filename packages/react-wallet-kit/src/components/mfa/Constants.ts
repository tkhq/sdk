import {
  faEnvelope,
  faFingerprint,
  faGlobe,
  faKey,
  faMobileScreen,
  faShieldHalved,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import type { v1AuthenticationType } from "@turnkey/sdk-types";

/** Map authentication types to display labels */
export const AUTH_TYPE_LABELS: Record<v1AuthenticationType, string> = {
  AUTHENTICATION_TYPE_PASSKEY: "Passkey",
  AUTHENTICATION_TYPE_API_KEY: "Wallet",
  AUTHENTICATION_TYPE_EMAIL_OTP: "Email",
  AUTHENTICATION_TYPE_SMS_OTP: "SMS",
  AUTHENTICATION_TYPE_OAUTH: "OAuth",
  AUTHENTICATION_TYPE_SESSION: "Session",
};

/** Map authentication types to icons */
export const AUTH_TYPE_ICONS: Record<v1AuthenticationType, IconDefinition> = {
  AUTHENTICATION_TYPE_PASSKEY: faFingerprint,
  AUTHENTICATION_TYPE_API_KEY: faKey,
  AUTHENTICATION_TYPE_EMAIL_OTP: faEnvelope,
  AUTHENTICATION_TYPE_SMS_OTP: faMobileScreen,
  AUTHENTICATION_TYPE_OAUTH: faGlobe,
  AUTHENTICATION_TYPE_SESSION: faShieldHalved,
};
