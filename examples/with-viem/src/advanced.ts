import * as path from "path";
import * as dotenv from "dotenv";

import { createAccount } from "@turnkey/viem";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  createWalletClient,
  http,
  recoverMessageAddress,
  recoverTypedDataAddress,
  stringToHex,
  hexToBytes,
  type Account,
} from "viem";
import { sepolia } from "viem/chains";
import { print, assertEqual } from "./util";
import { createNewWallet } from "./createNewWallet";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  if (!process.env.SIGN_WITH) {
    // If you don't specify a `SIGN_WITH`, we'll create a new wallet for you via calling the Turnkey API.
    await createNewWallet();
    return;
  }

  const turnkeyClient = new TurnkeyClient(
    {
      baseUrl: process.env.BASE_URL!,
    },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const turnkeyAccount = await createAccount({
    client: turnkeyClient,
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: sepolia,
    transport: http(
      `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY!}`
    ),
  });

  const address = client.account.address;
  print("Address:", address);

  const baseMessage = "Hello Turnkey";

  // 1. Sign a raw hex message
  const hexMessage = { raw: stringToHex(baseMessage) };
  let signature = await client.signMessage({
    message: hexMessage,
  });
  let recoveredAddress = await recoverMessageAddress({
    message: hexMessage,
    signature,
  });

  print("Turnkey-powered signature - raw hex message:", `${signature}`);
  assertEqual(address, recoveredAddress);

  // 2. Sign a raw bytes message
  const bytesMessage = { raw: hexToBytes(stringToHex(baseMessage)) };
  signature = await client.signMessage({
    message: bytesMessage,
  });
  recoveredAddress = await recoverMessageAddress({
    message: bytesMessage,
    signature,
  });

  print("Turnkey-powered signature - raw bytes message:", `${signature}`);
  assertEqual(address, recoveredAddress);

  // 3. Sign typed data (EIP-712)
  const typedData = {
    account: turnkeyAccount as Account,
    domain: {
      name: "Test",
      version: "1",
      chainId: 1,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    },
    types: {
      TestMessage: [{ name: "number", type: "uint256" }],
    },
    primaryType: "TestMessage",
    message: {
      number: 42n, // BigInt
    },
  };

  const types = {
    TransferRequest: [
      { name: "selector", type: "bytes4" },
      { name: "destination", type: "address" },
      { name: "token", type: "address" },
      { name: "nonStandardIndex", type: "uint256" },
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "amounts", type: "uint256[]" },
      { name: "tokenIds", type: "uint256[]" },
      { name: "data", type: "bytes" },
      { name: "nonce", type: "uint256" },
    ],
  };

  const request = {
    destination: "0x54FFabdc775e54bc852010C4AfF553183420E6bb",
    token: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    nonStandardIndex: 0n,
    tokenId: 0n,
    amount: 11527707n,
    amounts: [],
    tokenIds: [],
    data: "0x",
    selector: "0xc9a4324f",
    nonce: 3375574816n,
  };

  const message = {
    ...request
  };

  const td = {
    domain: {
      name: "AccountImplementation",
      version: "1",
      chainId: sepolia.id,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    },
    types,
    primaryType: "TransferRequest",
    message,
  }

  signature = await client.signTypedData(td);
  recoveredAddress = await recoverTypedDataAddress({
    ...td,
    signature,
  });

  print("Turnkey-powered signature - typed data (EIP-712):", `${signature}`);
  assertEqual(address, recoveredAddress);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
