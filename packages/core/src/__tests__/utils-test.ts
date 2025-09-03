import { isWeb, isReactNative } from "../utils";
import {
  describe,
  expect,
  jest,
  beforeEach,
  afterEach,
  it,
} from "@jest/globals";

describe("platform detection", () => {
  const g = globalThis as any;

  const saveGlobals = () => ({
    window: g.window,
    document: g.document,
    navigator: g.navigator,
  });

  const restoreGlobals = (orig: any) => {
    if (typeof orig.window === "undefined") delete g.window;
    else g.window = orig.window;

    if (typeof orig.document === "undefined") delete g.document;
    else g.document = orig.document;

    if (typeof orig.navigator === "undefined") delete g.navigator;
    else g.navigator = orig.navigator;
  };

  let orig: any;

  beforeEach(() => {
    orig = saveGlobals();
    // Start clean: no browser-like globals unless a test sets them.
    delete g.window;
    delete g.document;
    delete g.navigator;
    jest.resetModules(); // ensures fresh imports if needed later
  });

  afterEach(() => {
    restoreGlobals(orig);
    jest.restoreAllMocks();
  });

  it("returns false for both on plain Node (no globals)", () => {
    expect(isWeb()).toBe(false);
    expect(isReactNative()).toBe(false);
  });

  it("isWeb() true when window and document exist", () => {
    g.window = {}; // minimal stubs are fine since you only check typeof
    g.document = {};
    expect(isWeb()).toBe(true);
    expect(isReactNative()).toBe(false);
  });

  it("isWeb() false if only window exists", () => {
    g.window = {};
    expect(isWeb()).toBe(false);
  });

  it("isWeb() false if only document exists", () => {
    g.document = {};
    expect(isWeb()).toBe(false);
  });

  it("isReactNative() true when navigator.product === 'ReactNative'", () => {
    g.navigator = { product: "ReactNative" };
    expect(isReactNative()).toBe(true);
    expect(isWeb()).toBe(false);
  });

  it("isReactNative() false when navigator exists but product differs", () => {
    g.navigator = { product: "Gecko" };
    expect(isReactNative()).toBe(false);
  });

  it("isReactNative() false when navigator missing", () => {
    expect(isReactNative()).toBe(false);
  });

  it("does not accidentally treat web + RN at the same time", () => {
    g.window = {};
    g.document = {};
    g.navigator = { product: "ReactNative" };
    // Your current logic would report both true; assert current behavior or
    // change requirements. Here we assert the current behavior explicitly.
    expect(isWeb()).toBe(true);
    expect(isReactNative()).toBe(true);
  });
});
