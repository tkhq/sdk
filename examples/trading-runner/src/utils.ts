import type { TurnkeyApiTypes } from "@turnkey/http";
import { BigNumber, ethers } from "ethers";

// Environment
export enum Environment {
  GOERLI = "goerli",
  SEPOLIA = "sepolia",
  MAINNET = "mainnet",
}

const MAX_DECIMALS = 4;

export function findPrivateKeys(
  organization: TurnkeyApiTypes["v1OrganizationData"],
  tagName: string
): TurnkeyApiTypes["v1PrivateKey"][] {
  const tag = organization.tags?.find((tag: any) => {
    const isPrivateKeyTag = tag.tagType === "TAG_TYPE_PRIVATE_KEY";
    const isMatchingTag = tag.tagName === tagName;
    return isPrivateKeyTag && isMatchingTag;
  });

  const privateKeys = organization.privateKeys?.filter(
    (privateKey: TurnkeyApiTypes["v1PrivateKey"]) => {
      return privateKey.privateKeyTags.includes(tag!.tagId);
    }
  );

  return privateKeys || [];
}

// fromReadableAmount converts whole amounts to atomic amounts
export function fromReadableAmount(
  amount: number,
  decimals: number
): BigNumber {
  return ethers.utils.parseUnits(amount.toString(), decimals);
}

// toReadableAmount converts atomic amounts to whole amounts
export function toReadableAmount(
  rawAmount: number | string,
  decimals: number,
  maxDecimals = MAX_DECIMALS
): string {
  return ethers.utils.formatUnits(rawAmount, decimals).slice(0, maxDecimals);
}

// isKeyOfObject checks if a key exists within an object
export function isKeyOfObject<T>(
  key: string | number | symbol | undefined,
  obj: any
): key is keyof T {
  if (!key) return false;

  return key in obj;
}

export function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}
