import { describe, expect, it, jest } from "@jest/globals";

jest.mock(
  "@polyfills/window",
  () => ({
    __esModule: true,
    default: {
      localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
    },
  }),
  { virtual: true },
);

import { decodeBase64urlToString } from "@turnkey/encoding";

import { WalletStamper } from "../__wallet__/stamper";
import { Chain, WalletInterfaceType } from "../__types__";

const SIGNING_ACCOUNT = "signing-account-public-key";
const SWITCHED_ACCOUNT = "switched-account-public-key";

const provider = {
  interfaceType: WalletInterfaceType.Solana,
  chainInfo: { namespace: Chain.Solana },
  connectedAddresses: [SIGNING_ACCOUNT],
} as any;

/**
 * A wallet whose active account changes while the signature is being
 * approved, as happens when the user switches accounts in their wallet.
 */
function walletSwitchingAccountsDuringSign() {
  let active = SIGNING_ACCOUNT;

  return {
    sign: async () => {
      const signedBy = active;
      active = SWITCHED_ACCOUNT;
      return `signature-by-${signedBy}`;
    },
    getPublicKey: async () => active,
  } as any;
}

describe("WalletStamper.stamp (Solana)", () => {
  it("pairs the signature with the account that produced it", async () => {
    const stamper = new WalletStamper(walletSwitchingAccountsDuringSign());

    const stamp = await stamper.stamp("payload", provider);
    const { publicKey, signature } = JSON.parse(
      decodeBase64urlToString(stamp.stampHeaderValue),
    );

    expect(signature).toBe(`signature-by-${SIGNING_ACCOUNT}`);
    expect(publicKey).toBe(SIGNING_ACCOUNT);
  });
});
