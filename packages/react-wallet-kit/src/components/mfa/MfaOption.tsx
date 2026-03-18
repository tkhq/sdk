import { faKey } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type {
  v1AuthenticationMethod,
  v1AuthenticationType,
} from "@turnkey/sdk-types";
import { AUTH_TYPE_LABELS, AUTH_TYPE_ICONS } from "./Constants";
import { ActionButton } from "../design/Buttons";

interface MfaMethodButtonProps {
  method: v1AuthenticationMethod;
  groupSatisfied: boolean;
  approvingType: v1AuthenticationType | null;
  onApprove: (type: v1AuthenticationType) => void;
}

export function MfaMethodButton(props: MfaMethodButtonProps) {
  const { method, groupSatisfied, approvingType, onApprove } = props;
  const isApproving = approvingType === method.type;
  const label = AUTH_TYPE_LABELS[method.type] || method.type;
  const icon = AUTH_TYPE_ICONS[method.type] || faKey;

  return (
    <ActionButton
      key={method.type}
      loading={isApproving}
      loadingText={`Verifying ${label}...`}
      disabled={groupSatisfied || isApproving || !!approvingType}
      onClick={() => onApprove(method.type)}
      className="flex flex-row gap-2 text-base items-center"
    >
      <FontAwesomeIcon icon={icon} />
      {label}
    </ActionButton>
  );
}
