/**
 * WalletConnect Pay → Turnkey Signing Bridge
 *
 * Turnkey's ONLY role is signing. WC Pay handles tx construction,
 * gas (via 7702 paymaster), and broadcast.
 *
 * WC Pay sends RPC actions with methods:
 *   - eth_signTypedData_v4: Turnkey signs with PAYLOAD_ENCODING_EIP712
 *   - personal_sign: Turnkey signs with addEthereumPrefix
 */

interface WalletRpcAction {
  chainId: string;
  method: string;
  params: string; // JSON-encoded array
}

interface PayAction {
  walletRpc: WalletRpcAction;
}

type SignMessageFn = (params: any) => Promise<any>;

/**
 * Sign a single WC Pay action using Turnkey's signMessage.
 */
export async function signWcPayAction(
  action: WalletRpcAction,
  signMessage: SignMessageFn,
  walletAccount: any,
): Promise<string> {
  const { method, params } = action;
  const parsedParams = JSON.parse(params);

  switch (method) {
    case "eth_signTypedData_v4": {
      // params: [signerAddress, typedDataJSON]
      // Pass raw typed data JSON to Turnkey — it handles EIP-712 hashing server-side
      const typedDataJson =
        typeof parsedParams[1] === "string"
          ? parsedParams[1]
          : JSON.stringify(parsedParams[1]);

      const result = await signMessage({
        walletAccount,
        message: typedDataJson,
        addEthereumPrefix: false,
        encoding: "PAYLOAD_ENCODING_EIP712",
        hashFunction: "HASH_FUNCTION_NO_OP",
      });

      return assembleSignature(result);
    }

    case "personal_sign": {
      // params: [messageHex, signerAddress]
      const messageHex: string = parsedParams[0];

      // Convert hex to UTF-8 string
      let message: string;
      if (messageHex.startsWith("0x")) {
        const hex = messageHex.slice(2);
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        message = new TextDecoder().decode(bytes);
      } else {
        message = messageHex;
      }

      const result = await signMessage({
        walletAccount,
        message,
        addEthereumPrefix: true,
      });

      return assembleSignature(result);
    }

    case "eth_sendTransaction":
      throw new Error(
        "eth_sendTransaction is not supported — WC Pay handles gas and broadcast via its 7702 paymaster.",
      );

    default:
      throw new Error(`Unsupported WC Pay RPC method: ${method}`);
  }
}

/**
 * Sign all WC Pay actions in order. Returns signatures array.
 */
export async function signAllWcPayActions(
  actions: PayAction[],
  signMessage: SignMessageFn,
  walletAccount: any,
): Promise<string[]> {
  console.log(`[WCPay] Signing ${actions.length} action(s) with Turnkey...`);
  const signatures: string[] = [];

  for (const action of actions) {
    const sig = await signWcPayAction(
      action.walletRpc,
      signMessage,
      walletAccount,
    );
    signatures.push(sig);
  }

  console.log(`[WCPay] Signatures obtained: ${signatures.length}`);
  return signatures;
}

/**
 * Assemble Turnkey {r, s, v} into a 0x-prefixed 65-byte hex signature.
 *
 * Turnkey returns r, s as hex strings (without 0x prefix) and v as a
 * yParity string ("0" or "1"). We convert to standard Ethereum format:
 * 0x + r(64) + s(64) + v(2) = 132 chars.
 */
function assembleSignature(result: any): string {
  let r: string = result.r || "";
  let s: string = result.s || "";
  const v: string = result.v || "";

  // Strip 0x prefix if present
  if (r.startsWith("0x")) r = r.slice(2);
  if (s.startsWith("0x")) s = s.slice(2);

  r = r.padStart(64, "0");
  s = s.padStart(64, "0");

  // Normalize v (yParity) to recovery id
  if (!v) throw new Error("Turnkey returned empty v value in signature");
  let vNum: number;
  if (v === "00" || v === "0") {
    vNum = 27;
  } else if (v === "01" || v === "1") {
    vNum = 28;
  } else {
    vNum = parseInt(v, 10);
    if (vNum < 27) vNum += 27;
  }

  return `0x${r}${s}${vNum.toString(16).padStart(2, "0")}`;
}
