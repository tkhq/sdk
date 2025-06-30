import * as raw from "bs58check";

type Bs58Check = {
  encode(buf: Uint8Array): string;
  decode(str: string): Uint8Array;
  decodeUnsafe(str: string): Uint8Array | undefined;
};

const bs58check = ("decode" in raw ? raw : (raw as any).default) as Bs58Check;

export const { encode, decode, decodeUnsafe } = bs58check;
export default bs58check;
