/** @jest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, jest } from "@jest/globals";
import { SendTransactionPage } from "../components/send-transaction/SendTransaction";

const mockPopPage = jest.fn();
const mockCloseModal = jest.fn();

jest.mock("../providers/modal/Hook", () => ({
  useModal: () => ({
    popPage: mockPopPage,
    closeModal: mockCloseModal,
    isMobile: false,
  }),
}));

describe("SendTransactionPage", () => {
  it("reports an action rejection exactly once without rethrowing it", async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const rejection = new Error("denied");
    const onError = jest.fn();

    await act(async () => {
      root.render(
        <SendTransactionPage
          action={async () => Promise.reject(rejection)}
          caip2="eip155:1"
          onError={onError}
        />,
      );
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(rejection);
    expect(mockPopPage).toHaveBeenCalledTimes(1);
    expect(mockCloseModal).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });
});
