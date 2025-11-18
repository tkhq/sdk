import * as dotenv from "dotenv";
import * as path from "path";
import { fromHex, toHex } from "@mysten/sui/utils";
import { bcs } from "@mysten/sui/bcs";
import prompts from "prompts";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const USDC_DECIMALS = 6;

interface ParsedUsdcTransfer {
  sender: string;
  recipient: string;
  amount: bigint;
  amountFormatted: string;
  gasPayment: {
    objectId: string;
    version: string;
    digest: string;
  };
  usdcCoins: Array<{
    objectId: string;
    version: string;
    digest: string;
  }>;
  gasPrice: string;
  gasBudget: string;
  rawHex: string;
}

class BcsParser {
  private bytes: Uint8Array;
  private offset: number = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  readU8(): number {
    if (this.offset >= this.bytes.length) {
      throw new Error(`Offset ${this.offset} out of bounds (length: ${this.bytes.length})`);
    }
    const val = this.bytes[this.offset++];
    if (val === undefined) {
      throw new Error("Unexpected undefined value");
    }
    return val;
  }

  readU64(): bigint {
    const bytes = this.bytes.slice(this.offset, this.offset + 8);
    this.offset += 8;
    let value = 0n;
    for (let i = 0; i < 8; i++) {
      const byte = bytes[i];
      if (byte === undefined) {
        throw new Error(`Unexpected undefined at index ${i}`);
      }
      value |= BigInt(byte) << BigInt(i * 8);
    }
    return value;
  }

  readBytes(len: number): Uint8Array {
    const result = this.bytes.slice(this.offset, this.offset + len);
    this.offset += len;
    return result;
  }

  readVecLength(): number {
    return this.readU8();
  }

  readU16(): number {
    const bytes = this.bytes.slice(this.offset, this.offset + 2);
    this.offset += 2;
    return bytes[0]! | (bytes[1]! << 8);
  }

  readAddress(): string {
    return "0x" + toHex(this.readBytes(32));
  }

  readDigest(): string {
    // Digests are encoded with a length prefix in BCS
    const len = this.readU8();
    if (len !== 32) {
      throw new Error(`Expected digest length 32, got ${len}`);
    }
    return toHex(this.readBytes(32));
  }

  getOffset(): number {
    return this.offset;
  }

  hasMore(): boolean {
    return this.offset < this.bytes.length;
  }

  peekByte(offsetAhead: number = 0): number | undefined {
    return this.bytes[this.offset + offsetAhead];
  }
}

async function parseUsdcTransfer(
  hexPayload: string
): Promise<ParsedUsdcTransfer> {
  // Remove 0x prefix if present
  const cleanHex = hexPayload.startsWith("0x")
    ? hexPayload.slice(2)
    : hexPayload;

  // Convert hex to bytes
  const txBytes = fromHex(cleanHex);

  console.log(`\nParsing ${txBytes.length} bytes...`);
  console.log(`Full hex: ${toHex(txBytes)}\n`);

  const parser = new BcsParser(txBytes);

  // Parse TransactionData structure manually
  // Looking at the hex: 00 00000000 03 01 00 ...
  // After analyzing, this appears to be:
  // - Byte 0: TransactionData enum tag (0 = V1)
  // - Bytes 1-4: Appears to be expiration or padding (4 zero bytes)
  // - Byte 5: Number of inputs (0x03 = 3)
  // - Byte 6+: Start of input data

  const dataTag = parser.readU8();
  console.log(`TransactionData tag: ${dataTag}`);

  if (dataTag !== 0) {
    throw new Error(`Unsupported transaction data tag: ${dataTag}`);
  }

  // Read the 4 mystery bytes (likely TransactionExpiration::None or similar)
  const mystery1 = parser.readU8();
  const mystery2 = parser.readU8();
  const mystery3 = parser.readU8();
  const mystery4 = parser.readU8();
  console.log(`Mystery bytes: ${mystery1} ${mystery2} ${mystery3} ${mystery4}`);

  // The structure seems to be directly jumping to ProgrammableTransaction inputs
  // without an explicit transaction kind tag

  // ProgrammableTransaction structure
  // Vec<Input> - inputs
  const inputsLen = parser.readVecLength();
  console.log(`\nNumber of inputs: ${inputsLen}`);

  const inputs: any[] = [];
  for (let i = 0; i < inputsLen; i++) {
    const inputTag = parser.readU8();
    console.log(`\nInput ${i} tag: ${inputTag}`);

    if (inputTag === 0) {
      // Pure input
      const pureLen = parser.readVecLength();
      const pureBytes = parser.readBytes(pureLen);
      console.log(`  Pure input (${pureLen} bytes): ${toHex(pureBytes)}`);
      inputs.push({ type: "Pure", bytes: pureBytes });
    } else if (inputTag === 1) {
      // Object input
      const objTag = parser.readU8();
      console.log(`  Object tag: ${objTag}`);

      if (objTag === 0) {
        // ImmOrOwnedObject
        const objectId = parser.readAddress();
        const version = parser.readU64();
        const digest = parser.readDigest();
        console.log(`  ImmOrOwnedObject:`);
        console.log(`    Object ID: ${objectId}`);
        console.log(`    Version: ${version}`);
        console.log(`    Digest: ${digest}`);
        inputs.push({
          type: "Object",
          objectId,
          version: version.toString(),
          digest,
        });
      } else {
        throw new Error(`Unsupported object type: ${objTag}`);
      }
    } else {
      throw new Error(`Unsupported input type: ${inputTag}`);
    }
  }

  // Vec<Command> - transactions
  const commandsLen = parser.readVecLength();
  console.log(`\nNumber of commands: ${commandsLen}`);

  for (let i = 0; i < commandsLen; i++) {
    const cmdTag = parser.readU8();
    console.log(`\nCommand ${i} tag: ${cmdTag}`);

    // Parse and skip command data properly
    // Each command type has different arguments we need to consume
    if (cmdTag === 0) {
      // MoveCall
      console.log(`  MoveCall command`);
      // Skip: package, module, function, type_args, args
      throw new Error("MoveCall parsing not implemented");
    } else if (cmdTag === 1) {
      // TransferObjects
      console.log(`  TransferObjects command`);
      // Vec<Argument> objects
      const objectsLen = parser.readU8();
      console.log(`    Objects count: ${objectsLen}`);
      for (let j = 0; j < objectsLen; j++) {
        const argType = parser.readU8();
        console.log(`      Object ${j} argument type: ${argType}`);
        if (argType === 0) {
          // GasCoin - no additional data
          console.log(`      Object is GasCoin`);
        } else if (argType === 1) {
          // Input
          const inputIdx = parser.readU16();
          console.log(`      Object from input: ${inputIdx}`);
        } else if (argType === 2) {
          // Result
          const resultIdx = parser.readU16();
          console.log(`      Object from result: ${resultIdx}`);
        } else if (argType === 3) {
          // NestedResult
          parser.readU16(); // result index
          parser.readU16(); // sub-result index
        }
      }
      // Argument address
      const addrArgType = parser.readU8();
      console.log(`    Address argument type: ${addrArgType}`);
      if (addrArgType === 0) {
        // GasCoin - no additional data
        console.log(`    Address is GasCoin`);
      } else if (addrArgType === 1) {
        // Input
        const inputIdx = parser.readU16();
        console.log(`    Address from input: ${inputIdx}`);
      } else if (addrArgType === 2) {
        // Result
        const resultIdx = parser.readU16();
        console.log(`    Address from result: ${resultIdx}`);
      } else if (addrArgType === 3) {
        // NestedResult
        parser.readU16(); // result index
        parser.readU16(); // sub-result index
      }
    } else if (cmdTag === 2) {
      // SplitCoins
      console.log(`  SplitCoins command`);
      // Argument coin
      const coinArgType = parser.readU8();
      console.log(`    Coin argument type: ${coinArgType}`);
      if (coinArgType === 0) {
        // GasCoin - no additional data
        console.log(`    Coin is GasCoin`);
      } else if (coinArgType === 1) {
        // Input
        const inputIdx = parser.readU16();
        console.log(`    Coin from input: ${inputIdx}`);
      } else if (coinArgType === 2) {
        // Result
        const resultIdx = parser.readU16();
        console.log(`    Coin from result: ${resultIdx}`);
      } else if (coinArgType === 3) {
        // NestedResult
        parser.readU16(); // result index
        parser.readU16(); // sub-result index
      }
      // Vec<Argument> amounts
      const amountsLen = parser.readU8();
      console.log(`    Amounts count: ${amountsLen}`);
      for (let j = 0; j < amountsLen; j++) {
        const argType = parser.readU8();
        console.log(`      Amount ${j} argument type: ${argType}`);
        if (argType === 0) {
          // GasCoin - no additional data
          console.log(`      Amount is GasCoin`);
        } else if (argType === 1) {
          // Input
          const inputIdx = parser.readU16();
          console.log(`      Amount from input: ${inputIdx}`);
        } else if (argType === 2) {
          // Result
          const resultIdx = parser.readU16();
          console.log(`      Amount from result: ${resultIdx}`);
        } else if (argType === 3) {
          // NestedResult
          parser.readU16(); // result index
          parser.readU16(); // sub-result index
        }
      }
    } else if (cmdTag === 3) {
      // MergeCoins
      console.log(`  MergeCoins command`);
      // Argument destination
      const destArgType = parser.readU8();
      if (destArgType === 0) {
        // GasCoin - no index
      } else if (destArgType === 1) {
        parser.readU16(); // input index
      } else if (destArgType === 2) {
        parser.readU16(); // result index
      } else if (destArgType === 3) {
        parser.readU16(); // result index (first)
        parser.readU16(); // sub-result index
      }
      // Vec<Argument> sources
      const sourcesLen = parser.readU8();
      console.log(`    Sources count: ${sourcesLen}`);
      for (let j = 0; j < sourcesLen; j++) {
        const argType = parser.readU8();
        if (argType === 0) {
          // GasCoin - no index
        } else if (argType === 1) {
          parser.readU16(); // input index
        } else if (argType === 2) {
          parser.readU16(); // result index
        } else if (argType === 3) {
          parser.readU16(); // result index
          parser.readU16(); // sub-result index
        }
      }
    } else {
      throw new Error(`Unsupported command type: ${cmdTag}`);
    }
  }

  // After ProgrammableTransaction, parse sender
  console.log(`\nOffset before sender: ${parser.getOffset()}`);
  const sender = parser.readAddress();
  console.log(`Sender: ${sender}`);

  // GasData
  // Vec<ObjectRef> - payment
  const paymentLen = parser.readVecLength();
  console.log(`\nNumber of gas payments: ${paymentLen}`);

  const gasPaymentObjectId = parser.readAddress();
  const gasPaymentVersion = parser.readU64();
  const gasPaymentDigest = parser.readDigest();
  console.log(`Gas payment object ID: ${gasPaymentObjectId}`);
  console.log(`Gas payment version: ${gasPaymentVersion}`);
  console.log(`Gas payment digest: ${gasPaymentDigest}`);

  // owner (Address)
  const gasOwner = parser.readAddress();
  console.log(`Gas owner: ${gasOwner}`);

  // price (u64)
  const gasPrice = parser.readU64();
  console.log(`Gas price: ${gasPrice}`);

  // budget (u64)
  const gasBudget = parser.readU64();
  console.log(`Gas budget: ${gasBudget}`);

  console.log(`\nBytes remaining: ${txBytes.length - parser.getOffset()}`);

  // Extract USDC-specific information from inputs
  const usdcCoins: Array<{
    objectId: string;
    version: string;
    digest: string;
  }> = [];
  let amount: bigint = 0n;
  let recipient: string = "";

  inputs.forEach((input) => {
    if (input.type === "Object") {
      // Check if this is not the gas payment
      if (input.objectId !== gasPaymentObjectId) {
        usdcCoins.push({
          objectId: input.objectId,
          version: input.version,
          digest: input.digest,
        });
      }
    } else if (input.type === "Pure") {
      // Try to parse as u64 (amount)
      if (input.bytes.length === 8) {
        try {
          const value = bcs.u64().parse(input.bytes);
          const valueNum = typeof value === "bigint" ? value : BigInt(value);
          if (valueNum > 0n && valueNum < 1000000000000n) {
            amount = valueNum;
          }
        } catch {
          // Not a u64
        }
      }
      // Try to parse as address (recipient)
      else if (input.bytes.length === 32) {
        try {
          recipient = "0x" + toHex(input.bytes);
        } catch {
          // Not an address
        }
      }
    }
  });

  // Format amount
  const amountFormatted = `${Number(amount) / 10 ** USDC_DECIMALS} USDC`;

  return {
    sender,
    recipient,
    amount,
    amountFormatted,
    gasPayment: {
      objectId: gasPaymentObjectId,
      version: gasPaymentVersion.toString(),
      digest: gasPaymentDigest,
    },
    usdcCoins,
    gasPrice: gasPrice.toString(),
    gasBudget: gasBudget.toString(),
    rawHex: hexPayload,
  };
}

async function main() {
  console.log("=== USDC Transfer Parser for Sui ===\n");

  // Get hex payload from user or use default example
  const { hexPayload } = await prompts([
    {
      type: "text",
      name: "hexPayload",
      message: "Enter transaction hex payload (or press Enter for example):",
      initial:
        "00000000000301003e37572ca547a90d930a97b961217b58872e01c3bc4e30b9172f5c4f066668ecc811f8210000000020c3d194c711ac2ac42be80f416d912ccee86c8946dd4ae92e700ecae0e0b4013f0008640000000000000000208e4c7c4b16b18d944a70e38bb125e99afc64f4b03ed4b51e18b531ce9d00f98e02020100000101010001010200000102000988ac6caff1e3e55b4fd8abec4247098d34bb857baeb3195c760873ab7c9fb90168de0552a1f80040e3d86549af55b29850bb90e304cd14f03ecf98c0a1593eafc811f821000000002011536e0565fe40b723d0033b7af60faf7356225bbc03c59accda09a6b8772da90988ac6caff1e3e55b4fd8abec4247098d34bb857baeb3195c760873ab7c9fb9e803000000000000809698000000000000",
    },
  ]);

  try {
    const parsed = await parseUsdcTransfer(hexPayload);

    console.log("\n=== Parsed USDC Transfer ===");
    console.log(`Sender: ${parsed.sender}`);
    console.log(`Recipient: ${parsed.recipient}`);
    console.log(
      `Amount: ${parsed.amountFormatted} (${parsed.amount} base units)`
    );
    console.log(`\nGas Payment:`);
    console.log(`  Object ID: ${parsed.gasPayment.objectId}`);
    console.log(`  Version: ${parsed.gasPayment.version}`);
    console.log(`  Digest: ${parsed.gasPayment.digest}`);
    console.log(`  Price: ${parsed.gasPrice}`);
    console.log(`  Budget: ${parsed.gasBudget}`);
    console.log(`\nUSDC Coins Used:`);
    parsed.usdcCoins.forEach((coin, idx) => {
      console.log(`  Coin ${idx + 1}:`);
      console.log(`    Object ID: ${coin.objectId}`);
      console.log(`    Version: ${coin.version}`);
      console.log(`    Digest: ${coin.digest}`);
    });

    // Check if sending to self
    if (parsed.sender === parsed.recipient) {
      console.log(
        "\n⚠️  WARNING: This transaction sends USDC to the same address (sender)"
      );
    }
  } catch (error) {
    console.error("\nError parsing transaction:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
