import { TurnkeyClient } from '@turnkey/http';
import { WebauthnStamper } from '@turnkey/webauthn-stamper';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateRandomBuffer = (): ArrayBuffer => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr.buffer;
};

export const base64UrlEncode = (challenge: ArrayBuffer): string =>
  Buffer.from(challenge)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

const defaultLengths = {
  prefixLength: 8,
  suffixLength: 6,
};

export const truncate = (
  addr: string,
  {
    prefixLength = defaultLengths.prefixLength,
    suffixLength = defaultLengths.suffixLength,
  }: { prefixLength: number; suffixLength: number } = defaultLengths
) => {
  if (addr.length <= prefixLength + suffixLength) {
    return addr;
  }

  return `${addr.substring(0, prefixLength)}...${addr.substring(
    addr.length - suffixLength
  )}`;
};

export const getTurnkeyClient = () => {
  return new TurnkeyClient(
    { baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? '' },
    new WebauthnStamper({
      rpId: process.env.NEXT_PUBLIC_WEBAUTHN_RPID ?? '',
    })
  );
};
