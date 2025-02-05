import { test, expect } from "@jest/globals";
import { LocalStorageStamper } from "../index";

test("throws when instantiated outside of a browser environment", async function () {
  expect(() => {
    new LocalStorageStamper();
  }).toThrow("Cannot initialize local storage in non-browser environment");
});
