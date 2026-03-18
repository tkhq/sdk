import clsx from "clsx";
import type { HandleMfaParams } from "../../types/method-types";
import { useTurnkey } from "../../providers/client/Hook";
import { useModal } from "../../providers/modal/Hook";
import { SuccessPage } from "../design/Success";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type v1MfaStatus,
  type v1AuthenticationType,
  type v1RequiredAuthenticationMethod,
  type v1AuthenticationMethod,
} from "@turnkey/sdk-types";
import { MfaMethodButton } from "./MfaOption";
import { OrSeparator } from "../auth/OrSeparator";
import { StamperType } from "@turnkey/core";

type MfaPageProps = HandleMfaParams & {
  onSuccess?: () => void;
  onError?: (error: any) => void;
};

// Check if a required method step has been satisfied
function isGroupSatsified(
  step: v1RequiredAuthenticationMethod,
  satisfiedMethods: v1AuthenticationMethod[],
): boolean {
  return step.any.some((option) =>
    satisfiedMethods.some((s) => s.type === option.type),
  );
}

export function MfaPage(props: MfaPageProps) {
  const { mfaContext, successPageDuration = 2000, onSuccess, onError } = props;
  const { isMobile, pushPage, closeModal } = useModal();
  const { httpClient } = useTurnkey();

  const [mfaStatus, setMfaStatus] = useState<v1MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvingType, setApprovingType] =
    useState<v1AuthenticationType | null>(null);
  const [failedAttempt, setFailedAttempt] = useState(false);
  const mountedRef = useRef(true);

  const fetchMfaStatus = useCallback(async () => {
    if (!httpClient) return null;

    try {
      const res = await httpClient.getMfaStatus({
        activityId: mfaContext.activityId,
        organizationId: mfaContext.organizationId,
      });

      // Use the first MFA status
      // TODO (Amir): We can actually filter by userid in the query. How do we wanna get userId though? MfaContext?
      const status = res.mfaStatuses?.[0] ?? null;

      if (mountedRef.current) {
        setMfaStatus(status);
        setLoading(false);
      }

      return status;
    } catch (err) {
      if (mountedRef.current) {
        setLoading(false);
        onError?.(err);
      }
      return null;
    }
  }, [httpClient, mfaContext.activityId, mfaContext.organizationId, onError]);

  const showError = useCallback(() => {
    setFailedAttempt(true);
    setTimeout(() => {
      if (mountedRef.current) setFailedAttempt(false);
    }, 6000);
  }, []);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchMfaStatus();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchMfaStatus]);

  // Each of these approval functions will navigate to its own screen/flow.
  const approveWithPasskey = useCallback(async () => {
    await httpClient?.approveActivity(
      { fingerprint: mfaContext.fingerprint },
      StamperType.Passkey,
    );
  }, [httpClient, mfaContext.fingerprint]);

  const approveWithApiKey = useCallback(async () => {
    // TODO: trigger wallet (API key) approval flow
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }, []);

  const approveWithEmailOtp = useCallback(async () => {
    // TODO: trigger email OTP approval flow
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }, []);

  const approveWithSmsOtp = useCallback(async () => {
    // TODO: trigger SMS OTP approval flow
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }, []);

  const approveWithOauth = useCallback(async () => {
    // TODO: trigger OAuth approval flow
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }, []);

  const approveWithSession = useCallback(async () => {
    await httpClient?.approveActivity({ fingerprint: mfaContext.fingerprint });
  }, [httpClient, mfaContext.fingerprint]);

  // Run the approval flow for the given method, then re-check MFA status
  const handleApproveMethod = useCallback(
    async (type: v1AuthenticationType) => {
      setApprovingType(type);

      try {
        switch (type) {
          case "AUTHENTICATION_TYPE_PASSKEY":
            await approveWithPasskey();
            break;
          case "AUTHENTICATION_TYPE_API_KEY":
            await approveWithApiKey();
            break;
          case "AUTHENTICATION_TYPE_EMAIL_OTP":
            await approveWithEmailOtp();
            break;
          case "AUTHENTICATION_TYPE_SMS_OTP":
            await approveWithSmsOtp();
            break;
          case "AUTHENTICATION_TYPE_OAUTH":
            await approveWithOauth();
            break;
          case "AUTHENTICATION_TYPE_SESSION":
            await approveWithSession();
            break;
        }

        // Re-fetch MFA status to check if all steps are satisfied
        const updatedStatus = await fetchMfaStatus();

        if (updatedStatus?.satisfied) {
          pushPage({
            key: "MFA Success",
            content: (
              <SuccessPage
                text="Verification complete!"
                duration={successPageDuration}
                onComplete={() => {
                  onSuccess?.();
                  closeModal();
                }}
              />
            ),
            preventBack: true,
            showTitle: false,
          });
          return;
        }

        // Approval went through but MFA status didn't change - something might have gone wrong
        showError();
      } catch (err) {
        showError();
      } finally {
        if (mountedRef.current) {
          setApprovingType(null);
        }
      }
    },
    [
      approveWithPasskey,
      approveWithApiKey,
      approveWithEmailOtp,
      approveWithSmsOtp,
      approveWithOauth,
      approveWithSession,
      fetchMfaStatus,
      onSuccess,
      onError,
    ],
  );

  const requiredMethods = mfaStatus?.requiredMethods ?? [];
  const satisfiedMethods = mfaStatus?.satisfiedMethods ?? [];

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center py-0",
        isMobile ? "w-full" : "w-86",
      )}
    >
      <div className="my-6 flex flex-col items-center w-full">
        <FontAwesomeIcon icon={faShieldHalved} size={"2xl"} />
        <div className="text-2xl font-bold py-2 text-center">
          Multi-Factor Authentication
        </div>

        <div className="text-sm text-icon-text-light dark:text-icon-text-dark text-center !p-0">
          Complete the following steps to execute:
        </div>
        <div className="p-1 h-full rounded-md border border-modal-background-dark/10 dark:border-modal-background-light/10 bg-icon-background-light dark:bg-icon-background-dark text-icon-text-light dark:text-icon-text-dark my-2">
          <div className="text-xs font-mono!">{mfaContext.activityType}</div>
        </div>

        {loading ? (
          <div className="text-sm mt-6 animate-pulse text-icon-text-light dark:text-icon-text-dark">
            Loading MFA requirements...
          </div>
        ) : (
          <>
            <div
              className={clsx(
                "flex flex-col gap-3 w-full",
                failedAttempt && "animate-shake",
              )}
            >
              {requiredMethods.map((methodGroup, index) => {
                const groupSatisfied = isGroupSatsified(
                  methodGroup,
                  satisfiedMethods,
                );

                return (
                  <div
                    key={index}
                    className={clsx(
                      "rounded-lg border p-3 transition-all",
                      groupSatisfied
                        ? "border-success-light/50 dark:border-success-dark/50 bg-success-light/10 dark:bg-success-dark/10"
                        : "border-icon-background-light dark:border-icon-background-dark",
                    )}
                  >
                    <div
                      className={clsx(
                        "text-xs font-medium mb-2",
                        groupSatisfied
                          ? "text-success-light dark:text-success-dark"
                          : "text-icon-text-light dark:text-icon-text-dark",
                      )}
                    >
                      {groupSatisfied
                        ? "Complete!"
                        : methodGroup.any.length > 1
                          ? "One of the following"
                          : "Required"}
                    </div>
                    <div className="flex flex-col">
                      {methodGroup.any.map((method, methodIndex) => (
                        <>
                          <MfaMethodButton
                            key={method.type}
                            method={method}
                            groupSatisfied={groupSatisfied}
                            approvingType={approvingType}
                            onApprove={handleApproveMethod}
                          />
                          {methodIndex < methodGroup.any.length - 1 && (
                            <OrSeparator />
                          )}
                        </>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {failedAttempt && (
              <div className="text-xs text-danger-light dark:text-danger-dark text-center mt-3">
                Hmm that didn't work. Please make sure you're using the correct
                credential and try again.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
