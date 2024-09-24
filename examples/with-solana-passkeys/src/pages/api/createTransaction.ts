import type { NextApiRequest, NextApiResponse } from "next";
import {
  PublicKey,
  TransactionMessage,
  SystemProgram,
  VersionedTransaction,
} from "@solana/web3.js";

import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";

import { recentBlockhash } from "@/utils";

type CreateTransactionRequest = {
  fromAddress: string;
  destinationAddress: string;
  amount: string;
};

export type TCreatedTransaction = {
  serializedTransaction: string;
};

type ErrorMessage = {
  message: string;
};

// Every client-created transaction should be signed by the fee payer (parent org wallet)
export default async function createTransaction(
  req: NextApiRequest,
  res: NextApiResponse<TCreatedTransaction | ErrorMessage>
) {
  const { amount, fromAddress, destinationAddress } =
    req.body as CreateTransactionRequest;

  try {
    const turnkey = new Turnkey({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    // Parent org address
    const feePayerAddress = process.env.NEXT_PUBLIC_FEE_PAYER_ADDRESS!;
    const feePayerKey = new PublicKey(feePayerAddress);

    const turnkeySigner = new TurnkeySigner({
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      client: turnkey.apiClient(),
    });

    const fromKey = new PublicKey(fromAddress);
    const toKey = new PublicKey(destinationAddress);
    const blockhash = await recentBlockhash();

    const txMessage = new TransactionMessage({
      payerKey: feePayerKey,
      recentBlockhash: blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: fromKey,
          toPubkey: toKey,
          lamports: Number(amount),
        }),
      ],
    });

    const versionedTxMessage = txMessage.compileToV0Message();
    const transferTransaction = new VersionedTransaction(versionedTxMessage);

    await turnkeySigner.addSignature(transferTransaction, feePayerAddress);

    const serializedTransaction = Buffer.from(
      transferTransaction.serialize()
    ).toString("base64");

    res.status(200).json({
      serializedTransaction,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
