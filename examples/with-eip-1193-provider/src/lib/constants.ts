// This constant designates the type of credential we want to create.
// The enum only supports one value, "public-key"
// https://www.w3.org/TR/webauthn-2/#enumdef-publickeycredentialtype
// @todo - link to code where this is used?
export const PUBKEY_CRED_TYPE = "public-key";

// All algorithms can be found here: https://www.iana.org/assignments/cose/cose.xhtml#algorithms
// We only support ES256
export const ALG_ES256 = -7;
export const ALG_RS256 = -257;

export const ETHEREUM_WALLET_DEFAULT_PATH = "m/44'/60'/0'/0/0";
