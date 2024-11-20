import { beforeEach } from "@jest/globals";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { ETHEREUM_PRIVATE_KEY } from "./constants";

const account = privateKeyToAccount(ETHEREUM_PRIVATE_KEY);

const client = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
});

export function setupEthereumMock() {
  beforeEach(() => {
    const request = async ({
      method,
      params,
    }: {
      method: string;
      params: any[];
    }) => {
      if (method === "personal_sign") {
        const signature = await client.signMessage({ message: params[0] });
        return signature;
      }
      if (method === "eth_requestAccounts") {
        return [account.address];
      }
      return null;
    };

    // Mock window.ethereum
    (global as any).window = {
      ethereum: {
        request,
      },
    };
  });
}
