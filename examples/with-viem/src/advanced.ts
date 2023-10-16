import * as path from "path";
import * as dotenv from "dotenv";

import { createAccount } from "@turnkey/viem";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  createWalletClient,
  createPublicClient,
  http,
  recoverMessageAddress,
  recoverTypedDataAddress,
  stringToHex,
  hexToBytes,
  type Account,
  formatEther,
} from "viem";
// import { sepolia, goerli } from "viem/chains";
import { goerli } from "viem/chains";
import { print, assertEqual } from "./util";
import abi from "./abi.json";
import wethAbi from "./weth-abi.json";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
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
    privateKeyId: process.env.PRIVATE_KEY_ID!,
  });

  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: goerli,
    transport: http(
      `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY!}`
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
  const domain = {
    name: "Ether Mail",
    version: "1",
    chainId: 1,
    verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
  } as const;

  // The named list of all type definitions
  const types = {
    Person: [
      { name: "name", type: "string" },
      { name: "wallet", type: "address" },
    ],
    Mail: [
      { name: "from", type: "Person" },
      { name: "to", type: "Person" },
      { name: "contents", type: "string" },
    ],
  } as const;

  const typedData = {
    account: turnkeyAccount as Account,
    domain,
    types,
    primaryType: "Mail",
    message: {
      from: {
        name: "Cow",
        wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
      },
      to: {
        name: "Bob",
        wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
      },
      contents: "Hello, Bob!",
    },
  } as const;

  signature = await client.signTypedData(typedData);
  recoveredAddress = await recoverTypedDataAddress({
    ...typedData,
    signature,
  });

  print("Turnkey-powered signature - typed data (EIP-712):", `${signature}`);
  assertEqual(address, recoveredAddress);

  const account = client?.account?.address;
  // this works (note the omission of the required "account" parameter
  // const hash = await client.writeContract({
  //   abi: wethAbi,
  //   address: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  //   functionName: "deposit",
  //   chain: goerli,
  //   // args: ['0x1'],
  //   value: 1n,
  // });

  const hash = await client.writeContract({
    abi: abi,
    address: "0x85111DF47D97Cc1aB3e76889fCF08594d053E85d",
    functionName: "mint",
    chain: goerli,
  });

  console.log("hash", hash);

  const publicClient = createPublicClient({
    transport: http("https://rpc.ankr.com/eth_goerli"),
    chain: goerli,
  });

  // const { request } = await publicClient.simulateContract({
  //   abi: wethAbi,
  //   address: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  //   functionName: "deposit",
  //   chain: goerli,
  //   // args: ['0x1'],
  //   value: 1n,
  //   //account
  // });

  const { request } = await publicClient.simulateContract({
    abi: abi,
    address: "0x85111DF47D97Cc1aB3e76889fCF08594d053E85d",
    functionName: "mint",
    chain: goerli,
  });

  const hash2 = await client.writeContract(request);

  console.log('hash again', hash2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// import {
//   Abi,
//   AbiFunction,
//   AbiParametersToPrimitiveTypes,
//   ExtractAbiFunction,
//   ExtractAbiFunctionNames,
// } from 'abitype'
// import { abi } from './abi'

// declare function readContract<
//   TAbi extends Abi,
//   TFunctionName extends ExtractAbiFunctionNames<TAbi, 'pure' | 'view'>,
//   TAbiFunction extends AbiFunction = ExtractAbiFunction<
//     TAbi,
//     TFunctionName
//   >,
// >(config: {
//   abi: TAbi
//   functionName: TFunctionName | ExtractAbiFunctionNames<TAbi, 'pure' | 'view'>
//   args: AbiParametersToPrimitiveTypes<TAbiFunction['inputs'], 'inputs'>
// }): AbiParametersToPrimitiveTypes<TAbiFunction['outputs'], 'outputs'>

// const res = readContract({
//   abi,
//   functionName: 'balanceOf',
//   args: ['0xA0Cf798816D4b9b9866b5330EEa46a18382f251e'],
// })
