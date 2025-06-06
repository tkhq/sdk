// example script to parse and verify an enclave response
import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";
import { sha256 } from "@noble/hashes/sha256";
import { serialize, Schema } from "borsh";
import { p256 } from "@noble/curves/p256";

// TODO: add end to end flow, including transaction construction + making request to Turnkey

const rawJsonResponse = {
  parsedTransaction:
    '{"parsed_transaction":{"payload":{"transaction_metadata":[{"key":"runtime_encoding","value":"1"},{"key":"chain_id","value":"160039"},{"key":"nonce","value":"2"},{"key":"gas","value":"100000"},{"key":"gas_price","value":"100000000000"},{"key":"value","value":"0"},{"key":"to","value":"0xee492ba2717DdBd6b36d3A81b04a7268e262350A"},{"key":"data","value":"0x"},{"key":"max_fee_per_gas"},{"key":"max_priority_fee_per_gas"},{"key":"max_fee_per_blob_gas"}],"unsigned_payload":"e80285174876e800830186a094ee492ba2717ddbd6b36d3a81b04a7268e262350a8080830271278080"},"signature":{"scheme":3,"public_key":"04716208f9a297aebde668b949fbabd23a2d92c6d3017abf56af9b2e27fac889ec3f99f033e82872f323a7ac124ffc4dfe19bf67fd93cc8070aba224525564aaef04fdb364b9c337303db3df2e39efecd7667cb00bfa197e2cc0a850e6846e5d3f715d55371d0f64cc5c46e28ff8bb00bd403508e4120c337b257b6b65baed68bd57","message":"b49421254ffd9ea6cbe097e80acd17f04eed8a13bb95fe4120f80749ac935560","signature":"e9d9be1343eb38e76db4076c13b126fc27c97c86df1b2eca12b5f90ef27907a69f97cd2d7c967c2233bac557ba4c17cf3084aaecc8292c8e08a4199e4b6b6451"}}}',
};

class Metadata {
  key: string;
  value: string;

  constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
}

const metadataSchema = {
  struct: {
    key: "string",
    value: "string",
  },
};

const parsedTransactionPayloadSchema: Schema = {
  struct: {
    transaction_metadata: { array: { type: metadataSchema } },
    method_metadata: { array: { type: metadataSchema } },
    unsigned_payload: "string",
  },
};

const main = async () => {
  const parsedTransaction = JSON.parse(rawJsonResponse.parsedTransaction);
  const jsonPayload = parsedTransaction.parsed_transaction.payload;
  const jsonSignature = parsedTransaction.parsed_transaction.signature;

  const transformedMetadata = jsonPayload.transaction_metadata.map((m: any) => {
    return new Metadata(m.key, m.value ?? "");
  });

  const payload = {
    method_metadata: jsonPayload.method_metadata ?? [],
    transaction_metadata: transformedMetadata,
    unsigned_payload: jsonPayload.unsigned_payload,
  };

  // Turnkey borsh-encodes messages before signing, and thus we must apply some transformations to get the same result here
  const bytes = serialize(parsedTransactionPayloadSchema, payload, true);

  const digest = sha256(bytes);
  const digestHex = uint8ArrayToHexString(digest);

  const publicKey = jsonSignature.public_key;

  // first half is encryption key, second half is parser signer key
  const parserKey = publicKey.substring(publicKey.length / 2);

  assertEqual(jsonSignature.message, digestHex);

  const verified = p256.verify(
    jsonSignature.signature,
    digestHex,
    uint8ArrayFromHexString(parserKey),
    {
      prehash: true,
    },
  );

  assertEqual(true, verified);
};

main();

export function assertEqual<T>(left: T, right: T) {
  if (left !== right) {
    throw new Error(`${JSON.stringify(left)} !== ${JSON.stringify(right)}`);
  }
}
