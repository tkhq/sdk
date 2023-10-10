import { test, expect } from "@jest/globals";
import { IframeStamper } from "../index";

test("throws when instantiated outside of a browser environment", async function () {
  expect(() => {
    new IframeStamper({
      iframeUrl: "https://recovery.tkhqlabs.xyz",
      iframeContainerId: "my-container-id",
      iframeElementId: "my-iframe-id",
    });
  }).toThrow("cannot initialize iframe in non-browser environment");
});
