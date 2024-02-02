import { test, expect } from "@jest/globals";
import { PasskeyStamper } from "../index";

test("uses provided signature to make stamp", async function () {
  const stamper = new PasskeyStamper({
    rpId: "some-rpid",
  });
  expect(stamper.rpId).toBe("some-rpid");
});
