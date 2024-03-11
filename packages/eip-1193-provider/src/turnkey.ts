import {
  ApiKeyStamper,
  type TApiKeyStamperConfig,
} from '@turnkey/api-key-stamper';

export const createAPIKeyStamper = (options?: TApiKeyStamperConfig) => {
  const apiPublicKey =
    options?.apiPublicKey || process.env.TURNKEY_API_PUBLIC_KEY;
  const apiPrivateKey =
    options?.apiPrivateKey || process.env.TURNKEY_API_PRIVATE_KEY;

  if (!(apiPublicKey && apiPrivateKey)) {
    throw 'Error must provide public and private api key or define API_PUBLIC_KEY API_PRIVATE_KEY in your .env file';
  }

  return new ApiKeyStamper({
    apiPublicKey,
    apiPrivateKey,
  });
};

// export const createWebauthnStamper = async (
//   options?: TWebauthnStamperConfig
// ) => {
//   const { WebauthnStamper } = await import('@turnkey/webauthn-stamper');
//   const rpId = options?.rpId || process.env.NEXT_PUBLIC_TURNKEY_RPID;
//   if (!rpId) {
//     throw 'Error must provide rpId or define TURNKEY_RPID in your .env file';
//   }

//   return new WebauthnStamper({
//     ...options,
//     rpId,
//   });
// };
