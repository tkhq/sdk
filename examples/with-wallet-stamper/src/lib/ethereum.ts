import {
  createWalletClient,
  custom,
  Hex,
  recoverPublicKey as recoverPublicKeyViem,
} from "viem";
import { mainnet } from "viem/chains";
import "viem/window";

const client = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum!),
});

export const signMessage = async (message: Hex) => {
  // // Retrieve Account from an EIP-1193 Provider.
  const [account] =
    (await window.ethereum?.request({
      method: "eth_requestAccounts",
    })) || [];

  if (!account) {
    throw new Error("No account found");
  }

  const signature = await client.signMessage({
    account,
    message,
  });
  return signature;
};

export const recoverPublicKey = () => {};

export default {
  signMessage,
  recoverPublicKey,
};
