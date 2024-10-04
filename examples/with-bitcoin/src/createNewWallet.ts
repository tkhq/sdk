import { Turnkey } from "@turnkey/sdk-server";
import { refineNonNull } from "./util";
import prompts from "prompts";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const { walletParams, walletName } = await prompts([
    {
      type: "text",
      name: "walletName",
      message: "Name your new wallet",
    },
    {
      type: "select",
      name: "walletParams",
      message: "Select the type of wallet you would like to create",
      choices: [
        {
          title: "P2TR (testnet)",
          value: {
            path: "m/86'/1'/1'/0/0",
            addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2TR",
          },
        },
        {
          title: "P2TR (mainnet)",
          value: {
            path: "m/86'/0'/0'/0/0",
            addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2TR",
          },
        },
        {
          title: "P2WPKH (testnet)",
          value: {
            path: "m/84'/1'/1'/0/0",
            addressFormat: "ADDRESS_FORMAT_BITCOIN_TESTNET_P2WPKH",
          },
        },
        {
          title: "P2WPKH (mainnet)",
          value: {
            path: "m/84'/0'/0'/0/0",
            addressFormat: "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH",
          },
        },
      ],
    },
  ]);

  const response = await turnkeyClient.apiClient().createWallet({
    walletName,
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: walletParams.path,
        addressFormat: "ADDRESS_FORMAT_COMPRESSED",
      },
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: walletParams.path,
        addressFormat: walletParams.addressFormat,
      },
    ],
  });
  const walletId = refineNonNull(response.walletId);
  const publicKey = refineNonNull(response.addresses[0]);
  const address = refineNonNull(response.addresses[1]);

  // Success!
  console.log(
    [
      `New Bitcoin wallet created!`,
      `- Name: ${walletName}`,
      `- Wallet ID: ${walletId}`,
      `- Public key: ${publicKey}`,
      `- Address: ${address}`,
      "\nNow you can populate your `.env.local` with:",
      `SOURCE_COMPRESSED_PUBLIC_KEY="${publicKey}"`,
      `SOURCE_BITCOIN_ADDRESS="${address}"`,
    ].join("\n")
  );
}

main()
  .then((_res) => {
    console.log("Exiting.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
