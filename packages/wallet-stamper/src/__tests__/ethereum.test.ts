import { describe, expect, it } from "@jest/globals";
import { EthereumWallet, getCompressedPublicKey } from "../ethereum";

import {
  EXPECTED_SIGNATURE,
  EXPECTED_COMPRESSED_PUBLIC_KEY,
} from "./constants";

import { setupEthereumMock } from "./utils";

describe("EthereumWallet", () => {
  setupEthereumMock();

  it("should sign a message", async () => {
    const wallet = new EthereumWallet();
    const message = "MESSAGE";
    const signature = await wallet.signMessage(message);
    const compressedPublicKey = await getCompressedPublicKey(
      signature,
      message
    );
    expect(compressedPublicKey).toBe(EXPECTED_COMPRESSED_PUBLIC_KEY);
    expect(signature).toBe(EXPECTED_SIGNATURE);
  });

  it("should sign a message", async () => {
    const wallet = new EthereumWallet();
    const publicKey = await wallet.getPublicKey();

    expect(publicKey).toBe(EXPECTED_COMPRESSED_PUBLIC_KEY);
  });
});
