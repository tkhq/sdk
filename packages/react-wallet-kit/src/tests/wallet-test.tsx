/** @jest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { WalletAccount, WalletProvider } from "@turnkey/core";
import {
  ExternalWalletSelector,
  WalletSelectorMode,
} from "../components/auth/wallet/ExternalWalletSelector";
import type { TurnkeyCallbacks } from "../types/base";

const mockPushPage = jest.fn<(page: { content: JSX.Element }) => void>();
const mockPopPage = jest.fn();
const mockCloseModal = jest.fn();
const mockLoginOrSignupWithWallet =
  jest.fn<(params: unknown) => Promise<unknown>>();
const mockConnectWalletAccount =
  jest.fn<(provider: WalletProvider) => Promise<WalletAccount>>();
let mockCallbacks: TurnkeyCallbacks | undefined;

// `@turnkey/core` pulls in viem, which needs `TextEncoder` and other globals
// that jsdom lacks. The components only need these values from it.
jest.mock("@turnkey/core", () => ({
  ...(jest.requireActual("@turnkey/sdk-types") as object),
  WalletSource: { Embedded: "embedded", Connected: "connected" },
  WalletInterfaceType: { WalletConnect: "wallet-connect" },
  Chain: { Ethereum: "ethereum", Solana: "solana" },
}));

jest.mock("../providers/modal/Hook", () => ({
  useModal: () => ({
    pushPage: mockPushPage,
    popPage: mockPopPage,
    closeModal: mockCloseModal,
    isMobile: false,
  }),
}));

const walletProvider = {
  interfaceType: "solana",
  chainInfo: { namespace: "solana" },
  info: { name: "Test Wallet", icon: "" },
  provider: {},
  connectedAddresses: [],
} as unknown as WalletProvider;

const account = { address: "wallet-address" } as unknown as WalletAccount;

jest.mock("../providers/client/Hook", () => ({
  useTurnkey: () => ({
    walletProviders: [walletProvider],
    wallets: [],
    loginOrSignupWithWallet: mockLoginOrSignupWithWallet,
    connectWalletAccount: mockConnectWalletAccount,
    disconnectWalletAccount: jest.fn(),
    callbacks: mockCallbacks,
  }),
}));

// Renders the wallet selector in auth mode. With a single wallet it goes
// straight to the action page, which is rendered here in place of the modal.
async function renderAndSelectWallet() {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(
      <ExternalWalletSelector
        mode={WalletSelectorMode.Auth}
        sessionKey="session-key"
      />,
    );
  });

  expect(mockPushPage).toHaveBeenCalledTimes(1);
  const actionPage = mockPushPage.mock.calls[0]![0].content;
  mockPopPage.mockClear();

  await act(async () => {
    root.render(actionPage);
  });

  return { root };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCallbacks = undefined;
  mockLoginOrSignupWithWallet.mockResolvedValue({});
  mockConnectWalletAccount.mockResolvedValue(account);
});

describe("ExternalWalletSelector with callbacks.onWalletConnected", () => {
  it("completes the login in the SDK when the callback is not set", async () => {
    const { root } = await renderAndSelectWallet();

    expect(mockLoginOrSignupWithWallet).toHaveBeenCalledWith({
      walletProvider,
      sessionKey: "session-key",
    });
    expect(mockConnectWalletAccount).not.toHaveBeenCalled();
    expect(mockCloseModal).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it("hands the connected wallet over to the host and closes the modal", async () => {
    const onWalletConnected = jest.fn<
      NonNullable<TurnkeyCallbacks["onWalletConnected"]>
    >(async () => {});
    mockCallbacks = { onWalletConnected };

    const { root } = await renderAndSelectWallet();

    expect(mockConnectWalletAccount).toHaveBeenCalledWith(walletProvider);
    expect(onWalletConnected).toHaveBeenCalledWith({
      walletProvider,
      account,
      sessionKey: "session-key",
    });
    expect(mockLoginOrSignupWithWallet).not.toHaveBeenCalled();
    expect(mockCloseModal).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it("keeps the modal open and goes back when the callback rejects", async () => {
    const onWalletConnected = jest.fn<
      NonNullable<TurnkeyCallbacks["onWalletConnected"]>
    >(async () => {
      throw new Error("Backend rejected the login");
    });
    mockCallbacks = { onWalletConnected };

    const { root } = await renderAndSelectWallet();

    expect(onWalletConnected).toHaveBeenCalledTimes(1);
    expect(mockLoginOrSignupWithWallet).not.toHaveBeenCalled();
    expect(mockCloseModal).not.toHaveBeenCalled();
    expect(mockPopPage).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it("does not call the host when the wallet fails to connect", async () => {
    const onWalletConnected = jest.fn<
      NonNullable<TurnkeyCallbacks["onWalletConnected"]>
    >(async () => {});
    mockCallbacks = { onWalletConnected };
    mockConnectWalletAccount.mockRejectedValue(
      new Error("Connect wallet was cancelled by the user."),
    );

    const { root } = await renderAndSelectWallet();

    expect(onWalletConnected).not.toHaveBeenCalled();
    expect(mockLoginOrSignupWithWallet).not.toHaveBeenCalled();
    expect(mockCloseModal).not.toHaveBeenCalled();
    expect(mockPopPage).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });
});
