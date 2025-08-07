"use client";

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Field,
  Label,
  Radio,
  RadioGroup,
  MenuSeparator,
  Button,
} from "@headlessui/react";
import {
  ConnectedWallet,
  ExportType,
  useModal,
  useTurnkey,
  Wallet,
  WalletAccount,
  WalletSource,
} from "@turnkey/react-wallet-kit";
import { useEffect, useState } from "react";
import { EthereumSVG, SolanaSVG } from "../Svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAdd,
  faArrowDown,
  faArrowUp,
  faArrowUpRightFromSquare,
  faChevronDown,
  faGear,
  faPlus,
  faRss,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import {
  verifyEthSignatureWithAddress,
  verifySolSignatureWithAddress,
} from "@/utils";
import SignatureVerification from "./SignatureVerification";
import Image from "next/image";

export default function DemoPanel() {
  const {
    wallets,
    createWalletAccounts,
    createWallet,
    fetchWallets,
    handleSignMessage,
    handleExport,
    handleImport,
    handleLinkExternalWallet,
    getWalletProviders,
  } = useTurnkey();

  const { pushPage } = useModal();

  const [selectedWallet, setSelectedWallet] = useState<Wallet | undefined>(
    wallets[0] || null, // Initialize with null if wallets[0] is undefined
  );
  const [selectedWalletAccount, setSelectedWalletAccount] = useState<
    WalletAccount | undefined
  >(wallets[0]?.accounts[0] || null); // Initialize with null if no accounts exist

  const [connectedWallets, setConnectedWallets] = useState<
    ConnectedWallet[] | undefined
  >([]); // Initialize with an empty array
  const [connectedWalletIcons, setConnectedWalletIcons] = useState<string[]>(
    [],
  ); // Initialize with an empty array

  const getConnectedWalletIcons = async (): Promise<string[]> => {
    const res = await getWalletProviders();
    const providersVisited = new Set<string>();
    let icons: string[] = [];
    for (const provider of res) {
      if (
        provider.connectedAddresses.length > 0 &&
        !providersVisited.has(provider.info.name)
      ) {
        providersVisited.add(provider.info.name);
        icons.push(provider.info.icon ? provider.info.icon : "");
      }
    }
    return icons;
  };

  useEffect(() => {
    if (!selectedWallet) {
      setSelectedWallet(wallets[0]);
    }
    if (!selectedWalletAccount && wallets[0]?.accounts.length > 0) {
      setSelectedWalletAccount(wallets[0].accounts[0]);
    }

    const cw = wallets.filter((w) => w.source === WalletSource.Connected);
    if (cw) {
      getConnectedWalletIcons().then((icons) => {
        if (icons && icons.length > 0) setConnectedWalletIcons(icons);
      });
      setConnectedWallets(cw);
    } else {
      setConnectedWallets(undefined);
    }
  }, [wallets]);

  function truncateAddress(address: string) {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  return (
    <div className="sm:backdrop-blur-none h-[calc(100vh-4rem)] sm:h-fit flex items-center justify-center">
      <div
        className={`flex w-screen sm:w-96 sm:h-[30rem] flex-col gap-4 sm:border sm:border-icon-background-light sm:dark:border-panel-background-dark p-4 rounded-2xl bg-panel-background-light dark:bg-panel-background-dark`}
      >
        <div className="flex items-center justify-between">
          <Menu>
            <MenuButton className="relative text-left text-xl group p-2 gap-3 flex items-center w-fit cursor-pointer">
              <div className="flex flex-col w-full">
                <div className="flex items-center justify-between w-full gap-4">
                  <p className="text-base max-w-[25vw] sm:max-w-24 truncate font-medium">
                    {selectedWallet?.walletName}
                  </p>
                  <div className="absolute top-1/2 -translate-y-1/2 -right-5">
                    {selectedWallet?.source === WalletSource.Connected ? (
                      <ConnectedWalletIcon />
                    ) : (
                      <EmbeddedWalletIcon />
                    )}
                  </div>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`transition-transform text-base group-data-open:rotate-180`}
                  />
                </div>
              </div>
            </MenuButton>
            <MenuItems
              anchor="bottom start"
              transition
              className="origin-top max-h-10 tk-scrollbar overflow-y-clip flex flex-col gap-3 transition duration-100 ease-out data-closed:scale-95 data-closed:opacity-0 relative z-50 bg-draggable-background-light dark:bg-draggable-background-dark rounded-lg shadow-lg p-2"
            >
              {wallets.length > 0 &&
                wallets.map((wallet) => {
                  if (wallet.walletId !== selectedWallet?.walletId)
                    return (
                      <MenuItem key={wallet.walletId}>
                        <div className="flex items-center justify-between w-full cursor-pointer">
                          <Button
                            onClick={() => {
                              setSelectedWallet(wallet);
                              setSelectedWalletAccount(
                                wallet.accounts[0] || undefined,
                              );
                            }}
                            className="flex items-center gap-3 w-full cursor-pointer"
                          >
                            <p className="truncate">{wallet.walletName}</p>{" "}
                            {wallet.source === WalletSource.Connected && (
                              <span className="text-primary-text-light dark:text-primary-text-dark border text-[10px] rounded-full py-0.5 px-1 border-primary-light dark:border-primary-dark bg-primary-light/30 dark:bg-primary-dark/30">
                                connected
                              </span>
                            )}
                          </Button>
                        </div>
                      </MenuItem>
                    );
                })}
              {wallets.length !== 1 && (
                <hr className="border-icon-text-light dark:border-icon-text-dark w-full" />
              )}
              <MenuItem>
                <Button
                  onClick={async () => {
                    const embeddedWallets = wallets.filter(
                      (w) => w.source === WalletSource.Embedded,
                    );
                    const walletId = await createWallet({
                      walletName: `Wallet ${embeddedWallets.length + 1}`,
                      accounts: [
                        "ADDRESS_FORMAT_ETHEREUM",
                        "ADDRESS_FORMAT_SOLANA",
                      ],
                    });
                    const newWallets = await fetchWallets();
                    const newWallet =
                      newWallets.find((w) => w.walletId === walletId) ||
                      newWallets[0];
                    setSelectedWallet(newWallet);
                    setSelectedWalletAccount(
                      newWallet.accounts[0] || undefined,
                    );
                  }}
                  className="relative hover:cursor-pointer flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md text-xs bg-icon-background-light dark:bg-icon-background-dark text-icon-text-light dark:text-icon-text-dark"
                >
                  <div className="relative z-10 flex items-center justify-center rounded-full gap-2">
                    <FontAwesomeIcon icon={faAdd} />
                    Add Wallet
                  </div>
                </Button>
              </MenuItem>
            </MenuItems>
          </Menu>
          <Button
            onClick={async () => {
              await handleLinkExternalWallet();
            }}
            className=" active:scale-95 px-4 py-2 text-sm rounded-full border-2 border-background-light dark:border-background-dark hover:bg-panel-background-light/80 dark:hover:bg-panel-background-dark/80 hover:cursor-pointer hover:border-primary-light dark:hover:border-primary-dark transition-all"
          >
            {connectedWallets && connectedWallets.length > 0 ? (
              <span className="relative flex items-center">
                <StackedImg connectedWalletIcons={connectedWalletIcons} />
                Connected{" "}
                <div className="flex absolute top-0.5 -right-1.5">
                  <div className="absolute animate-ping size-2 bg-green-500 rounded-full border border-modal-background-light dark:border-modal-background-dark" />
                  <div className="size-2 bg-green-500 rounded-full border border-modal-background-light dark:border-modal-background-dark" />
                </div>
              </span>
            ) : (
              "Connect Wallet"
            )}
          </Button>
        </div>
        {selectedWallet?.accounts && selectedWallet?.accounts.length > 0 ? (
          <RadioGroup
            value={selectedWalletAccount}
            onChange={setSelectedWalletAccount}
            className="flex flex-col gap-2"
          >
            {selectedWallet?.accounts.map((account) => (
              <Field
                key={account.walletAccountId}
                className="flex items-center justify-between bg-background-light dark:bg-background-dark rounded-lg p-2"
              >
                <Label className="rounded-full w-full p-1 flex text-center items-center gap-3 cursor-pointer">
                  {account.addressFormat === "ADDRESS_FORMAT_ETHEREUM" ? (
                    <EthereumSVG className="w-5 h-5" />
                  ) : (
                    <SolanaSVG className="w-5 h-5" />
                  )}
                  {truncateAddress(account.address)}
                  <Button
                    className="hover:cursor-pointer"
                    onClick={() => {
                      window.open(
                        account.addressFormat === "ADDRESS_FORMAT_ETHEREUM"
                          ? `https://etherscan.io/address/${account.address}`
                          : `https://solscan.io/account/${account.address}`,
                        "_blank",
                      );
                    }}
                  >
                    <FontAwesomeIcon
                      icon={faArrowUpRightFromSquare}
                      className="text-icon-text-light dark:text-icon-text-dark text-sm"
                    />
                  </Button>
                </Label>
                <Radio
                  value={account}
                  className="outline-none group flex size-4 items-center justify-center rounded-full border bg-white"
                >
                  <span className="size-2.5 transition rounded-full group-data-checked:bg-primary-light dark:group-data-checked:bg-primary-dark" />
                </Radio>
              </Field>
            ))}
          </RadioGroup>
        ) : (
          <Button
            onClick={async () => {
              await createWalletAccounts({
                walletId: selectedWallet?.walletId || "",
                accounts: ["ADDRESS_FORMAT_ETHEREUM", "ADDRESS_FORMAT_SOLANA"],
              });
            }}
            className="flex items-center justify-center w-full text-sm transition-all text-text-light dark:text-text-dark rounded-lg bg-background-light dark:bg-background-dark p-3 hover:bg-background-light/80 dark:hover:bg-background-dark/80"
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4 mr-2" />
            Add Accounts
          </Button>
        )}

        <Button
          onClick={async () => {
            if (!selectedWalletAccount) return;
            const messageToSign = "Signing within Turnkey Demo.";
            const res = await handleSignMessage({
              message: messageToSign,
              walletAccount: selectedWalletAccount,
              addEthereumPrefix: true,
            });
            if (!res) {
              console.error("Failed to sign message");
              return;
            }

            const verificationPassed =
              selectedWalletAccount.addressFormat === "ADDRESS_FORMAT_ETHEREUM"
                ? verifyEthSignatureWithAddress(
                    messageToSign,
                    res.r,
                    res.s,
                    res.v,
                    selectedWalletAccount.address,
                  )
                : verifySolSignatureWithAddress(
                    messageToSign,
                    res.r,
                    res.s,
                    selectedWalletAccount.address,
                  );
            pushPage({
              key: "Signature Verification",
              content: (
                <SignatureVerification
                  verificationPassed={verificationPassed}
                  signature={`${res.r}${res.s}${res.v}`}
                />
              ),
              preventBack: true,
              showTitle: false,
            });
          }}
          className="bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark rounded-lg px-4 py-2 active:scale-95 transition-transform cursor-pointer"
        >
          Sign Message
        </Button>
        <hr className="border-draggable-background-light dark:border-draggable-background-dark" />
        <div className="flex justify-between items-center gap-4">
          <Button
            onClick={async () => {
              if (selectedWallet) {
                await handleExport({
                  walletId: selectedWallet.walletId,
                  exportType: ExportType.Wallet,
                });
              }
            }}
            className="active:scale-95 flex items-center justify-center w-full text-sm transition-all text-text-light dark:text-text-dark rounded-lg bg-background-light dark:bg-background-dark p-3 hover:bg-background-light/80 dark:hover:bg-background-dark/80 cursor-pointer"
          >
            <FontAwesomeIcon icon={faArrowUp} className="w-4 h-4 mr-2" /> Export
            Wallet
          </Button>
          <Button
            className="active:scale-95 flex items-center justify-center w-full text-sm transition-all text-text-light dark:text-text-dark rounded-lg bg-background-light dark:bg-background-dark p-3 hover:bg-background-light/80 dark:hover:bg-background-dark/80 cursor-pointer"
            onClick={async () => {
              await handleImport({
                defaultWalletAccounts: [
                  "ADDRESS_FORMAT_SOLANA",
                  "ADDRESS_FORMAT_ETHEREUM",
                ],
              });
            }}
          >
            <FontAwesomeIcon icon={faArrowDown} className="w-4 h-4 mr-2" />{" "}
            Import Wallet
          </Button>
        </div>
      </div>
    </div>
  );
}

const StackedImg = ({
  connectedWalletIcons,
}: {
  connectedWalletIcons: (string | undefined)[];
}) => {
  return (
    <div className="mr-2 flex items-center">
      {connectedWalletIcons.map((icon, index) =>
        icon && index < 2 ? (
          <Image
            key={index}
            width={24}
            height={24}
            src={icon}
            alt={`Wallet Icon ${index}`}
            className={`w-6 h-6 bg-icon-background-light dark:bg-icon-background-dark rounded-full p-0.5 ${index > 0 ? "-ml-3" : ""}`}
          />
        ) : null,
      )}
      {connectedWalletIcons.length > 2 && (
        <span className="text-xs text-text-light dark:text-text-dark">
          +{connectedWalletIcons.length - 2}
        </span>
      )}
    </div>
  );
};

const ConnectedWalletIcon = () => {
  return (
    <div className="flex items-center relative w-fit">
      <FontAwesomeIcon
        icon={faWallet}
        className="bg-primary-background-light dark:bg-primary-dark rounded-full p-1 text-xs"
      />
      <FontAwesomeIcon
        icon={faRss}
        className="text-[8px] -top-3.5 -right-1 absolute bg-icon-background-light dark:bg-icon-background-dark rounded-full p-0.5 -ml-3 mt-3"
      />
    </div>
  );
};

const EmbeddedWalletIcon = () => {
  return (
    <div className="flex items-center relative w-fit">
      <FontAwesomeIcon
        icon={faWallet}
        className="bg-icon-background-light dark:bg-icon-background-dark rounded-full p-1 text-xs"
      />
      <FontAwesomeIcon
        icon={faGear}
        className="text-[8px] -top-3.5 -right-1 absolute bg-icon-background-light dark:bg-icon-background-dark rounded-full p-0.5 -ml-3 mt-3"
      />
    </div>
  );
};
