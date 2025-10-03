import { resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod";
import { parseUnits, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import { generateP256KeyPair } from "@turnkey/crypto";
import {
  buildIntentSigningPolicy,
  buildPaymasterExecutionPolicy,
  GasStationClient,
  buildTokenTransfer,
  DEFAULT_EXECUTION_CONTRACT,
} from "@turnkey/gas-station";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const envSchema = z.object({
  BASE_URL: z.string().url(),
  API_PRIVATE_KEY: z.string().min(1),
  API_PUBLIC_KEY: z.string().min(1),
  ORGANIZATION_ID: z.string().min(1),
  USDC_ADDRESS: z.string().min(1).optional(),
  DAI_ADDRESS: z.string().min(1).optional(),
});

const env = envSchema.parse(process.env);

// Default to Base mainnet addresses if not specified
const USDC_ADDRESS =
  (env.USDC_ADDRESS as `0x${string}`) ||
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DAI_ADDRESS =
  (env.DAI_ADDRESS as `0x${string}`) ||
  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb";

describe("Gas Station Policy Enforcement", () => {
  let turnkeyClient: TurnkeyServerSDK;
  let subOrgId: string;
  let eoaWalletAddress: `0x${string}`;
  let paymasterWalletAddress: `0x${string}`;
  let eoaUserId: string;
  let paymasterUserId: string;
  let eoaPrivateKey: string;
  let eoaPublicKey: string;
  let paymasterPrivateKey: string;
  let paymasterPublicKey: string;
  let gasStationClient: GasStationClient;
  let paymasterGasStationClient: GasStationClient;

  beforeAll(async () => {
    turnkeyClient = new TurnkeyServerSDK({
      apiBaseUrl: env.BASE_URL,
      apiPrivateKey: env.API_PRIVATE_KEY,
      apiPublicKey: env.API_PUBLIC_KEY,
      defaultOrganizationId: env.ORGANIZATION_ID,
    });

    // Generate API key pairs for EOA and Paymaster
    const eoaKeyPair = generateP256KeyPair();
    eoaPublicKey = eoaKeyPair.publicKey;
    eoaPrivateKey = eoaKeyPair.privateKey;

    const paymasterKeyPair = generateP256KeyPair();
    paymasterPublicKey = paymasterKeyPair.publicKey;
    paymasterPrivateKey = paymasterKeyPair.privateKey;

    // Create sub-organization with EOA and Paymaster users
    const result = await turnkeyClient.apiClient().createSubOrganization({
      organizationId: env.ORGANIZATION_ID,
      subOrganizationName: `Gas Station Test - ${Date.now()}`,
      rootUsers: [
        {
          userName: "Admin User",
          userEmail: "admin@example.com",
          apiKeys: [
            {
              apiKeyName: "Admin API Key",
              publicKey: env.API_PUBLIC_KEY,
              curveType: "API_KEY_CURVE_P256" as const,
            },
          ],
          authenticators: [],
          oauthProviders: [],
        },
        {
          userName: "EOA User",
          userEmail: "eoa@example.com",
          apiKeys: [
            {
              apiKeyName: "EOA API Key",
              publicKey: eoaPublicKey,
              curveType: "API_KEY_CURVE_P256" as const,
            },
          ],
          authenticators: [],
          oauthProviders: [],
        },
        {
          userName: "Paymaster User",
          userEmail: "paymaster@example.com",
          apiKeys: [
            {
              apiKeyName: "Paymaster API Key",
              publicKey: paymasterPublicKey,
              curveType: "API_KEY_CURVE_P256" as const,
            },
          ],
          authenticators: [],
          oauthProviders: [],
        },
      ],
      rootQuorumThreshold: 1,
      wallet: {
        walletName: "EOA Wallet",
        accounts: [
          {
            curve: "CURVE_SECP256K1" as const,
            pathFormat: "PATH_FORMAT_BIP32" as const,
            path: "m/44'/60'/0'/0/0",
            addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
          },
        ],
      },
      disableEmailRecovery: false,
      disableEmailAuth: false,
    });

    const subOrgResult = result.activity.result.createSubOrganizationResultV7;
    subOrgId = subOrgResult?.subOrganizationId!;
    const adminUserId = subOrgResult?.rootUserIds?.[0]!;
    eoaUserId = subOrgResult?.rootUserIds?.[1]!;
    paymasterUserId = subOrgResult?.rootUserIds?.[2]!;
    eoaWalletAddress = subOrgResult?.wallet?.addresses?.[0]! as `0x${string}`;

    // Create paymaster wallet
    const walletResult = await turnkeyClient.apiClient().createWallet({
      organizationId: subOrgId,
      walletName: "Paymaster Wallet",
      accounts: [
        {
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/60'/0'/0/1",
          addressFormat: "ADDRESS_FORMAT_ETHEREUM",
        },
      ],
    });

    paymasterWalletAddress = walletResult.activity.result.createWalletResult
      ?.addresses?.[0]! as `0x${string}`;

    // Create EOA USDC policy
    const eoaPolicy = buildIntentSigningPolicy({
      organizationId: subOrgId,
      eoaUserId: eoaUserId,
      restrictions: {
        allowedContracts: [USDC_ADDRESS],
      },
      policyName: `EOA USDC Only Policy - ${Date.now()}`,
    });

    await turnkeyClient.apiClient().createPolicy(eoaPolicy);

    // Update root quorum (remove EOA and Paymaster users)
    await turnkeyClient.apiClient().updateRootQuorum({
      organizationId: subOrgId,
      threshold: 1,
      userIds: [adminUserId],
    });

    // Setup EOA client
    const eoaTurnkeyClient = new TurnkeyServerSDK({
      apiBaseUrl: env.BASE_URL,
      apiPrivateKey: eoaPrivateKey,
      apiPublicKey: eoaPublicKey,
      defaultOrganizationId: subOrgId,
    });

    const eoaAccount = await createAccount({
      client: eoaTurnkeyClient.apiClient(),
      organizationId: subOrgId,
      signWith: eoaWalletAddress,
    });

    const eoaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: base,
      transport: http(),
    });

    gasStationClient = new GasStationClient({
      walletClient: eoaWalletClient,
      explorerUrl: "https://basescan.org",
    });

    // Setup Paymaster client
    const paymasterTurnkeyClient = new TurnkeyServerSDK({
      apiBaseUrl: env.BASE_URL,
      apiPrivateKey: paymasterPrivateKey,
      apiPublicKey: paymasterPublicKey,
      defaultOrganizationId: subOrgId,
    });

    const paymasterAccount = await createAccount({
      client: paymasterTurnkeyClient.apiClient(),
      organizationId: subOrgId,
      signWith: paymasterWalletAddress,
    });

    const paymasterWalletClient = createWalletClient({
      account: paymasterAccount,
      chain: base,
      transport: http(),
    });

    paymasterGasStationClient = new GasStationClient({
      walletClient: paymasterWalletClient,
      explorerUrl: "https://basescan.org",
    });

    // Create paymaster policy with correct execution contract
    const paymasterPolicy = buildPaymasterExecutionPolicy({
      organizationId: subOrgId,
      paymasterUserId: paymasterUserId,
      executionContractAddress: DEFAULT_EXECUTION_CONTRACT,
      restrictions: {
        allowedContracts: [USDC_ADDRESS.toLowerCase() as `0x${string}`],
      },
      policyName: `Paymaster USDC Policy - ${Date.now()}`,
    });

    await turnkeyClient.apiClient().createPolicy(paymasterPolicy);
  }, 60000); // 60s timeout for setup

  describe("Layer 1: EOA Intent Signing Policy", () => {
    it("should allow EOA to sign USDC transfer intent", async () => {
      const nonce = 0n;
      const executionParams = buildTokenTransfer(
        USDC_ADDRESS as `0x${string}`,
        eoaWalletAddress,
        parseUnits("1", 6),
      );
      const builder = gasStationClient.createIntent();
      const intent = await builder
        .setTarget(executionParams.outputContract)
        .withValue(executionParams.value ?? 0n)
        .withCallData(executionParams.callData)
        .sign(nonce);

      expect(intent).toBeDefined();
      expect(intent.signature).toBeDefined();
      expect(intent.eoaAddress).toBe(eoaWalletAddress);
    });

    it("should block EOA from signing DAI transfer intent (not in policy)", async () => {
      const nonce = 1n;
      const executionParams = buildTokenTransfer(
        DAI_ADDRESS as `0x${string}`,
        eoaWalletAddress,
        parseUnits("1", 18),
      );
      const builder = gasStationClient.createIntent();

      await expect(
        builder
          .setTarget(executionParams.outputContract)
          .withValue(executionParams.value ?? 0n)
          .withCallData(executionParams.callData)
          .sign(nonce),
      ).rejects.toThrow();
    });

    it("should allow EOA to sign DAI transfer after adding DAI policy", async () => {
      // Add DAI policy
      const eoaDaiPolicy = buildIntentSigningPolicy({
        organizationId: subOrgId,
        eoaUserId: eoaUserId,
        restrictions: {
          allowedContracts: [DAI_ADDRESS.toLowerCase() as `0x${string}`],
        },
        policyName: `EOA DAI Policy - ${Date.now()}`,
      });

      await turnkeyClient.apiClient().createPolicy(eoaDaiPolicy);

      // Now sign DAI intent
      const nonce = 2n;
      const executionParams = buildTokenTransfer(
        DAI_ADDRESS as `0x${string}`,
        eoaWalletAddress,
        parseUnits("1", 18),
      );
      const builder = gasStationClient.createIntent();
      const intent = await builder
        .setTarget(executionParams.outputContract)
        .withValue(executionParams.value ?? 0n)
        .withCallData(executionParams.callData)
        .sign(nonce);

      expect(intent).toBeDefined();
      expect(intent.signature).toBeDefined();
    });
  });

  describe("Layer 2: Paymaster Execution Policy", () => {
    let usdcIntent: any;
    let daiIntent: any;

    beforeAll(async () => {
      // Create USDC intent
      const nonce1 = 0n;
      const usdcParams = buildTokenTransfer(
        USDC_ADDRESS as `0x${string}`,
        eoaWalletAddress,
        parseUnits("1", 6),
      );
      const builder1 = gasStationClient.createIntent();
      usdcIntent = await builder1
        .setTarget(usdcParams.outputContract)
        .withValue(usdcParams.value ?? 0n)
        .withCallData(usdcParams.callData)
        .sign(nonce1);

      // Create DAI intent
      const nonce2 = 2n;
      const daiParams = buildTokenTransfer(
        DAI_ADDRESS as `0x${string}`,
        eoaWalletAddress,
        parseUnits("1", 18),
      );
      const builder2 = gasStationClient.createIntent();
      daiIntent = await builder2
        .setTarget(daiParams.outputContract)
        .withValue(daiParams.value ?? 0n)
        .withCallData(daiParams.callData)
        .sign(nonce2);
    });

    it("should allow paymaster to sign USDC execution (in policy)", async () => {
      const signedTx =
        await paymasterGasStationClient.signExecution(usdcIntent);

      expect(signedTx).toBeDefined();
      expect(signedTx.startsWith("0x")).toBe(true);
    });

    it("should block paymaster from signing DAI execution (not in policy)", async () => {
      await expect(
        paymasterGasStationClient.signExecution(daiIntent),
      ).rejects.toThrow(/permission/i);
    });
  });
});
