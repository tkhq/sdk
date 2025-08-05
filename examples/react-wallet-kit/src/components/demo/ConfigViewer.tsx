import { useTurnkeyConfig } from "@/providers/config/ConfigProvider";
import { faCopy } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@headlessui/react";

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

  return (
    <div className="flex flex-col gap-4 relative">
      <pre className="bg-background-light dark:bg-background-dark p-2 rounded-lg max-h-96 overflow-y-auto tk-scrollbar text-sm">
        {`{\n${Object.entries(config)
          .filter(([key]) => !omitKeys.includes(key)) // Omit specified keys
          .map(([key, value]) => `  ${key}: ${renderValue(value, 4, key)}`)
          .join(",\n")}\n}`}
      </pre>
      <Button
        onClick={() => {
          navigator.clipboard.writeText(
            `{\n${Object.entries(config)
              .filter(([key]) => !omitKeys.includes(key)) // Omit specified keys
              .map(([key, value]) => `  ${key}: ${renderValue(value, 4, key)}`)
              .join(",\n")}\n}`,
          );
        }}
      >
        <FontAwesomeIcon
          icon={faCopy}
          className="text-icon-text-light active:scale-95 dark:text-icon-text-dark absolute top-2 right-4 transition-all p-2 rounded-full hover:bg-icon-background-light dark:hover:bg-icon-background-dark"
        />
      </Button>
    </div>
  );
}
