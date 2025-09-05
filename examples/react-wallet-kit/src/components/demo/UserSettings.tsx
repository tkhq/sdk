import { useModal, useTurnkey } from "@turnkey/react-wallet-kit";
import { OAuthProviders } from "@turnkey/sdk-types";
import {
  AppleSVG,
  CheckboxCircleFillSVG,
  DeleteSVG,
  EditSVG,
  FacebookSVG,
  GoogleSVG,
} from "../Svg";
import EmailAuthButton from "./AuthButtons/EmailAuthButton";
import PhoneAuthButton from "./AuthButtons/PhoneAuthButton";
import SocialButton from "./AuthButtons/SocialButton";
import AuthenticatorButton from "./AuthButtons/AuthenticatorButton";
import DeleteSubOrgWarning from "./DeleteSubOrgWarning";
import { Button, Transition } from "@headlessui/react";
import { useEffect, useRef, useState } from "react";

export default function UserSettings() {
  const {
    user,
    handleAddEmail,
    handleAddPhoneNumber,
    handleUpdateUserName,
    config: clientConfig,
    logout,
  } = useTurnkey();

  const { pushPage } = useModal();

  const [canRemoveAuthMethod, setCanRemoveAuthMethod] = useState(false);

  useEffect(() => {
    if (!user) return setCanRemoveAuthMethod(false);
    const userAuthMethods =
      (user?.authenticators?.length || 0) +
      (user?.oauthProviders?.length || 0) +
      (user?.apiKeys?.filter((apiKey) =>
        apiKey.apiKeyName.startsWith("wallet-auth")
      ).length || 0) +
      (user?.userEmail ? 1 : 0) +
      (user?.userPhoneNumber ? 1 : 0);
    setCanRemoveAuthMethod(userAuthMethods > 1);
  }, [user]);

  function handleDeleteSubOrganization() {
    pushPage({
      key: "Delete sub-organization",
      content: <DeleteSubOrgWarning />,
      preventBack: true,
      showTitle: false,
    });
  }

  return (
    <Transition
      appear
      show={true}
      as={"div"}
      enter="transition-all duration-300 ease-out"
      enterFrom="-translate-x-96 opacity-0"
      enterTo="translate-x-0 opacity-100"
    >
      <div className="sm:backdrop-blur-none h-[calc(100vh-4rem)] sm:h-fit flex items-center justify-center">
        <div
          className={`flex w-screen sm:w-96 sm:h-[30rem] flex-col gap-4 sm:border sm:border-icon-background-light sm:dark:border-panel-background-dark px-4 py-6 rounded-2xl bg-panel-background-light dark:bg-panel-background-dark`}
        >
          <h2>Manage Account</h2>
          <div className="flex flex-col gap-2 rounded-lg dark:bg-background-dark bg-background-light p-2">
            <AccountParam
              label="User name"
              value={user?.userName}
              onClick={async () => {
                return await handleUpdateUserName();
              }}
            />
            {user?.userEmail && (
              <AccountParam
                label="E-mail"
                value={user.userEmail}
                onClick={async () => {
                  return await handleAddEmail();
                }}
                verified={true}
              />
            )}
            {user?.userPhoneNumber && (
              <AccountParam
                label="Phone number"
                value={user.userPhoneNumber}
                onClick={async () => {
                  return await handleAddPhoneNumber();
                }}
                verified={true}
              />
            )}
          </div>
          <hr className="border-draggable-background-light dark:border-draggable-background-dark" />
          <h2>Auth Methods</h2>
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto tk-scrollbar">
            <div className="flex flex-col gap-2">
              {clientConfig?.auth?.methods?.emailOtpAuthEnabled && (
                <EmailAuthButton canRemoveAuthMethod={canRemoveAuthMethod} />
              )}
              {clientConfig?.auth?.methods?.smsOtpAuthEnabled && (
                <PhoneAuthButton canRemoveAuthMethod={canRemoveAuthMethod} />
              )}
              {clientConfig?.auth?.methods?.googleOauthEnabled && (
                <SocialButton
                  canRemoveAuthMethod={canRemoveAuthMethod}
                  provider={OAuthProviders.GOOGLE}
                  logo={<GoogleSVG className="w-6 h-6" />}
                />
              )}
              {clientConfig?.auth?.methods?.appleOauthEnabled && (
                <SocialButton
                  canRemoveAuthMethod={canRemoveAuthMethod}
                  provider={OAuthProviders.APPLE}
                  logo={<AppleSVG className="w-6 h-6" />}
                />
              )}
              {clientConfig?.auth?.methods?.facebookOauthEnabled && (
                <SocialButton
                  canRemoveAuthMethod={canRemoveAuthMethod}
                  provider={OAuthProviders.FACEBOOK}
                  logo={<FacebookSVG className="w-6 h-6" />}
                />
              )}
              {clientConfig?.auth?.methods?.passkeyAuthEnabled && (
                <AuthenticatorButton
                  canRemoveAuthMethod={canRemoveAuthMethod}
                />
              )}
            </div>
          </div>
          <hr className="border-draggable-background-light dark:border-draggable-background-dark" />
          <div className="flex justify-between items-center gap-4">
            <Button
              className="w-full text-sm transition-all text-text-light dark:text-text-dark rounded-lg bg-background-light dark:bg-background-dark p-2 hover:bg-background-light/80 dark:hover:bg-background-dark/80 cursor-pointer"
              onClick={() => {
                logout();
              }}
            >
              Log out
            </Button>
            <Button
              onClick={async () => {
                handleDeleteSubOrganization();
              }}
              className="w-full justify-center text-sm transition-all rounded-lg p-2 flex items-center gap-2 border-transparent hover:bg-danger-light/10 dark:hover:bg-danger-dark/10 border cursor-pointer"
            >
              <DeleteSVG className="w-6 h-6 text-danger-light dark:text-danger-dark shrink-0" />{" "}
              <span className="shrink-0">Delete Account</span>
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  );
}

const AccountParam = ({
  label,
  value,
  onClick,
  verified,
}: {
  label: string;
  value: string | undefined;
  onClick: () => Promise<string>;
  verified?: boolean | undefined;
}) => {
  return (
    <div className="flex flex-col">
      <label className="text-left text-xs text-text-light dark:text-text-dark/80">
        {label}
      </label>
      <button
        onClick={onClick}
        className={`flex text-left text-sm justify-between text-text-light dark:text-text-dark hover:cursor-pointer ${value ? "opacity-100" : "opacity-50"}`}
      >
        <p className="flex items-center gap-3 text-text-light/60 dark:text-text-dark/60">
          {value}{" "}
          {verified && (
            <CheckboxCircleFillSVG className="w-4 h-4 text-success-light dark:text-success-dark" />
          )}
        </p>
        <EditSVG className="w-4 h-4 text-text-light/40 dark:text-text-dark/40" />
      </button>
    </div>
  );
};
