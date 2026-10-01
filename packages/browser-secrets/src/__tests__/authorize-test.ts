import { describe, expect, test } from "@jest/globals";

import {
  authorize,
  createSecretRef,
  requiredSelectors,
  validateRequest,
  type TargetObservation,
} from "../index";

const origin = "http://localhost:5001";
const provider = "http://127.0.0.1:5001";
const page = `${origin}/checkout`;
const card = createSecretRef({
  secretId: "card",
  staticProperties: {
    "sbm:origin": origin,
    "sbm:frame-origin": provider,
    "sbm:fields": JSON.stringify({
      number: "input[name=n]",
      cvc: "input[name=c]",
    }),
  },
});
const observation: TargetObservation = {
  browserSessionId: "b1",
  tabId: "t1",
  topLevelUrl: page,
  targets: [
    {
      elementId: "e-number",
      frames: [
        { frameId: "f0", documentId: "d0", url: page, origin },
        {
          frameId: "f1",
          documentId: "d1",
          url: `${provider}/fields`,
          origin: provider,
        },
      ],
      selectorMatches: { "input[name=n]": true },
    },
    {
      elementId: "e-cvc",
      frames: [
        { frameId: "f0", documentId: "d0", url: page, origin },
        {
          frameId: "f2",
          documentId: "d2",
          url: `${provider}/cvc`,
          origin: provider,
        },
      ],
      shadowRoot: "open",
      selectorMatches: { "input[name=c]": true },
    },
  ],
};
const request = {
  targets: [
    { key: "number", elementId: "e-number" },
    { key: "cvc", elementId: "e-cvc" },
  ],
};

describe("authorize", () => {
  test("an allowed decision carries the identities later checks must match", () => {
    expect(authorize(card, request, observation)).toEqual({
      allowed: true,
      secretId: "card",
      browserSessionId: "b1",
      tabId: "t1",
      targets: [
        {
          elementId: "e-number",
          key: "number",
          selector: "input[name=n]",
          frameId: "f1",
          documentId: "d1",
        },
        {
          elementId: "e-cvc",
          key: "cvc",
          selector: "input[name=c]",
          frameId: "f2",
          documentId: "d2",
        },
      ],
    });
  });

  test("parses static properties every time and ignores ref.binding", () => {
    const tampered = {
      ...card,
      binding: { origin },
      staticProperties: { ...card.staticProperties, "sbm:fields": "{" },
    };
    expect(authorize(tampered, request, observation)).toEqual({
      allowed: false,
      reason: "binding_invalid",
    });
  });

  test("does not mutate its inputs", () => {
    const before = JSON.stringify([card, request, observation]);
    authorize(card, request, observation);
    expect(JSON.stringify([card, request, observation])).toBe(before);
  });

  test("an unobserved extra target in the observation is ignored", () => {
    const one = { targets: [request.targets[0]!] };
    expect(authorize(card, one, observation).allowed).toBe(true);
  });

  test("duplicate element IDs in the observation are malformed", () => {
    const dup = {
      ...observation,
      targets: [observation.targets[0]!, observation.targets[0]!],
    };
    expect(authorize(card, request, dup)).toEqual({
      allowed: false,
      reason: "observation_invalid",
    });
  });

  test("non-object inputs are refused, not thrown", () => {
    expect(authorize(card, null as never, observation)).toEqual({
      allowed: false,
      reason: "request_invalid",
    });
    expect(authorize(card, request, null as never)).toEqual({
      allowed: false,
      reason: "observation_invalid",
    });
    expect(authorize(null as never, request, observation)).toEqual({
      allowed: false,
      reason: "binding_invalid",
    });
  });
});

describe("validateRequest and requiredSelectors", () => {
  test("refuses before any observation", () => {
    expect(validateRequest(card, { targets: [{ elementId: "e" }] })).toEqual({
      allowed: false,
      reason: "unkeyed_target_for_field_binding",
      targetIndex: 0,
    });
  });

  test("lists the selector evidence the host must collect", () => {
    expect(requiredSelectors(card, request)).toEqual([
      { elementId: "e-number", selector: "input[name=n]" },
      { elementId: "e-cvc", selector: "input[name=c]" },
    ]);
    const originOnly = createSecretRef({
      secretId: "k",
      staticProperties: { "sbm:origin": origin },
    });
    expect(
      requiredSelectors(originOnly, { targets: [{ elementId: "e" }] }),
    ).toEqual([{ elementId: "e", selector: undefined }]);
    expect(requiredSelectors(card, { targets: [] })).toEqual([]);
  });
});
