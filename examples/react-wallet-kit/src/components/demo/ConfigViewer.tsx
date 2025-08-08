import { useTurnkeyConfig } from "@/providers/config/ConfigProvider";
import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Transition } from "@headlessui/react";
import clsx from "clsx";
import { useState } from "react";

const envVars: Record<string, string> = {
  authProxyId: '"<ENV_VAR_AUTH_PROXY_ID>"',
  organizationId: '"<ENV_VAR_ORGANIZATION_ID>"',
};

const omitKeys = [
  "apiBaseUrl",
  "authProxyUrl",
  "importIframeUrl",
  "exportIframeUrl",
  "googleClientId",
  "appleClientId",
  "facebookClientId",
  "oAuthRedirectUri",
  "walletConfig",
  "renderModalInProvider",
];

function renderValue(value: any, indentLevel = 2, key?: string): string {
  const indent = " ".repeat(indentLevel);

  if (key && envVars[key]) {
    return envVars[key];
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => `${indent}${renderValue(item, indentLevel + 2)}`)
      .join(",\n");
    return `[\n${items}\n${" ".repeat(indentLevel - 2)}]`;
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
      .filter(([nestedKey]) => !omitKeys.includes(nestedKey)) // Omit specified keys
      .map(
        ([nestedKey, nestedValue]) =>
          `${indent}${nestedKey}: ${renderValue(nestedValue, indentLevel + 2, nestedKey)}`,
      )
      .join(",\n");
    return `{\n${entries}\n${" ".repeat(indentLevel - 2)}}`;
  }

  return typeof value === "string" ? `"${value}"` : String(value);
}

export default function ConfigViewer() {
  const { config } = useTurnkeyConfig();
  const [showCopied, setShowCopied] = useState(false);

  const handleCopy = () => {
    setShowCopied(true);
    navigator.clipboard.writeText(
      `{\n${Object.entries(config)
        .filter(([key]) => !omitKeys.includes(key)) // Omit specified keys
        .map(([key, value]) => `  ${key}: ${renderValue(value, 4, key)}`)
        .join(",\n")}\n}`,
    );
    setTimeout(() => {
      setShowCopied(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-4 relative">
      <pre className="bg-background-light dark:bg-background-dark p-2 rounded-lg max-h-96 overflow-y-auto tk-scrollbar text-sm">
        {`{\n${Object.entries(config)
          .filter(([key]) => !omitKeys.includes(key)) // Omit specified keys
          .map(([key, value]) => `  ${key}: ${renderValue(value, 4, key)}`)
          .join(",\n")}\n}`}
      </pre>
      <Transition
        show={showCopied}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="flex text-center items-center justify-center absolute w-full h-full p-2 bg-black/20 backdrop-blur-sm">
          <span className="text-white text-sm">
            Config copied to clipboard!
          </span>
        </div>
      </Transition>

      <Button className="cursor-pointer" onClick={handleCopy}>
        <FontAwesomeIcon
          icon={showCopied ? faCheck : faCopy}
          className={clsx(
            "active:scale-95 absolute top-2 right-4 transition-all p-2 rounded-full hover:bg-icon-background-light dark:hover:bg-icon-background-dark",
            showCopied
              ? "text-success-light text:bg-success-dark"
              : "text-icon-text-light dark:text-icon-text-dark",
          )}
        />
        {showCopied && (
          <FontAwesomeIcon
            icon={showCopied ? faCheck : faCopy}
            className={clsx(
              "active:scale-95 absolute top-2 right-4 transition-all p-2 rounded-full hover:bg-icon-background-light dark:hover:bg-icon-background-dark animate-ping",
              showCopied
                ? "text-success-light text:bg-success-dark"
                : "text-icon-text-light dark:text-icon-text-dark",
            )}
          />
        )}
      </Button>
    </div>
  );
}
