import type { Turnkey, TurnkeyApiTypes } from "@turnkey/sdk-server";

/**
 * Get a list of private keys for a given tag
 * @param turnkeyClient
 * @param tagName
 * @returns a list of private keys matching the passed in tag
 */
export default async function getPrivateKeysForTag(
  turnkeyClient: Turnkey,
  tagName: string
): Promise<TurnkeyApiTypes["v1PrivateKey"][]> {
  const response = await turnkeyClient.apiClient().listPrivateKeyTags({
    organizationId: process.env.ORGANIZATION_ID!,
  });

  const tag = response.privateKeyTags.find(
    (tag: TurnkeyApiTypes["datav1Tag"]) => {
      const isPrivateKeyTag = tag.tagType === "TAG_TYPE_PRIVATE_KEY";
      const isMatchingTag = tag.tagName === tagName;
      return isPrivateKeyTag && isMatchingTag;
    }
  );

  if (!tag) {
    throw new Error(
      `unable to find tag ${tagName} in organization ${process.env.ORGANIZATION_ID}`
    );
  }

  const privateKeysResponse = await turnkeyClient.apiClient().getPrivateKeys({
    organizationId: process.env.ORGANIZATION_ID!,
  });

  const privateKeys = privateKeysResponse.privateKeys.filter(
    (privateKey: any) => {
      return privateKey.privateKeyTags.includes(tag!.tagId);
    }
  );

  if (!privateKeys || privateKeys.length == 0) {
    throw new Error(
      `unable to find tag ${tagName} in organization ${process.env.ORGANIZATION_ID}`
    );
  }

  return privateKeys;
}
