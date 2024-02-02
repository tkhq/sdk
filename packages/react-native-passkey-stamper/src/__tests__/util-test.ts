import { test, expect } from "@jest/globals";
import { getChallengeFromPayload, getRandomChallenge } from "../util";

test("generates correct challenges from payloads", async function () {
  // You can verify that this is the right value with:
  // 1) base 64 decode the test vector:
  //    $ echo -n "MmNmMjRkYmE1ZmIwYTMwZTI2ZTgzYjJhYzViOWUyOWUxYjE2MWU1YzFmYTc0MjVlNzMwNDMzNjI5MzhiOTgyNA==" | base64 -d
  //    2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
  // 2) hash "hello" yourself
  //    $ echo -n "hello" | sha256sum
  //    2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  -
  // We have a match!
  expect(getChallengeFromPayload("hello")).toBe(
    "MmNmMjRkYmE1ZmIwYTMwZTI2ZTgzYjJhYzViOWUyOWUxYjE2MWU1YzFmYTc0MjVlNzMwNDMzNjI5MzhiOTgyNA=="
  );
});

test("generates valid random challenges", async function () {
  const challenge = getRandomChallenge();
  expect(challenge.length).toBe(64);

  // Expect (implicitly) that the challenge is valid hex -- otherwise it'd fail
  const buffer = Buffer.from(challenge, "hex");
  // 64 hex characters should be exactly 32 bytes
  expect(buffer.length).toBe(32);
});
