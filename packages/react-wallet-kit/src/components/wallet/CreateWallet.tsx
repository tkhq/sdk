import clsx from "clsx";
import { useModal } from "../../providers";
import type { HandleCreateWalletParams } from "../../types/method-types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWallet } from "@fortawesome/free-solid-svg-icons";
import { ActionButton } from "../design/Buttons";
import { parseCreateWalletInput, v1WalletAccountParams } from "@turnkey/core";

type CreateWalletProps = HandleCreateWalletParams & {
  onSuccess: (walletId: string) => void;
  onError: (error: any) => void;
};

function DetailEntry(props: { name: string; value: string | number | object }) {
  const { name, value } = props;
  const text =
    typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value);

  return (
    <div key={name} className="flex gap-1 items-center">
      <div className="font-mono! flex-shrink-0">{name}:</div>
      <div className="font-mono! truncate flex-1 min-w-0" title={text}>
        {text}
      </div>
    </div>
  );
}

export function CreateWallet(props: CreateWalletProps) {
  const { walletName, mnemonicLength, accounts } = props;
  const { isMobile } = useModal();

  const parsedAccounts: v1WalletAccountParams[] = parseCreateWalletInput({
    accounts,
  });

  return (
    <div className={clsx("mt-8", isMobile ? "w-full" : "w-96")}>
      <div className="mt-6 mb-5 flex flex-col items-center gap-3">
        <FontAwesomeIcon icon={faWallet} size={"3x"} />
        <div className="text-2xl font-bold text-center">{"Create Wallet"}</div>
        <div className="text-icon-text-light dark:text-icon-text-dark text-center !p-0">
          {"You are about to create a new wallet with the following data:"}
        </div>
        <div className="w-full h-full overflow-y-scroll tk-scrollbar flex flex-col mt-2 max-h-56 rounded-md border border-modal-background-dark/10 dark:border-modal-background-light/10 bg-icon-background-light dark:bg-icon-background-dark text-icon-text-light dark:text-icon-text-dark text-sm font-mono!">
          <div className="gap-2 flex flex-col p-3">
            <DetailEntry name="Wallet name" value={walletName} />
            <DetailEntry
              name="Mnemonic length"
              value={`${mnemonicLength ?? 12} words`}
            />
            <div className="border-t border-modal-background-dark/10 dark:border-modal-background-light/10" />
            <div className="gap-4 flex flex-col">
              {parsedAccounts.length === 0 ? (
                <div className="text-muted-foreground">No accounts</div>
              ) : (
                parsedAccounts.map((acct, idx) => (
                  <div key={idx} className="bg-transparent">
                    <div className="font-mono! mb-2">Account {idx + 1}:</div>
                    <div className="flex flex-col gap-2 ml-2">
                      {Object.entries(acct).map(([k, v]) => (
                        <DetailEntry name={k} value={v} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex my-2 mt-0">
        <ActionButton
          onClick={() => {}}
          loading={false}
          className="w-full md:max-w-md bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark"
        >
          Continue
        </ActionButton>
      </div>
    </div>
  );
}
