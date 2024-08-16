import { test, expect } from "@jest/globals";
import { createEmbeddedAPIKey } from "../utils";

test("createEmbeddedAPIKey", async function () {
  // Test valid uncompressed public key
  const uncompPubKey =
    "0400d2eb47be2006c29db5fe9941dd686d19ddeea85a0328894f08091f6b5be9b366c4872345594c12a7f7c47c62dd8074542934820fce5ee0ddc55d6d1d8dd312";
  await expect(createEmbeddedAPIKey(uncompPubKey)).resolves.not.toThrow();

  const embAPIKey = await createEmbeddedAPIKey(uncompPubKey);
  expect(embAPIKey.authBundle).toBeDefined();
  expect(embAPIKey.authBundle).not.toBeNull();
  expect(embAPIKey.authBundle).not.toEqual("");

  expect(embAPIKey.publicKey).toBeDefined();
  expect(embAPIKey.publicKey).not.toBeNull();
  expect(embAPIKey.authBundle).not.toEqual("");

  // test invalid uncompressed public key (last byte has been changed)
  const uncompPubKeyInvalid =
    "0400d2eb47be2006c29db5fe9941dd686d19ddeea85a0328894f08091f6b5be9b366c4872345594c12a7f7c47c62dd8074542934820fce5ee0ddc55d6d1d8dd311";
  await expect(createEmbeddedAPIKey(uncompPubKeyInvalid)).rejects.toThrow();
});
