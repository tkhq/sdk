/**
 * Lazy-loaded wrapper for UpdatePhoneNumber component
 * 
 * This ensures the phone update UI and all its dependencies
 * (including phone libraries) are only loaded when user wants to update phone.
 */

import { lazy, Suspense } from "react";
import { Spinner } from "../design/Spinners";
import type { StamperType } from "@turnkey/core";

// Dynamically import UpdatePhoneNumber component only when needed
const UpdatePhoneNumberLazy = lazy(() =>
  import("./UpdatePhoneNumber").then((module) => ({
    default: module.UpdatePhoneNumber,
  }))
);

type UpdatePhoneNumberProps = {
  successPageDuration?: number | undefined;
  organizationId: string;
  userId: string;
  onSuccess: (userId: string) => void;
  onError: (error: any) => void;
  title?: string;
  subTitle?: string;
  stampWith?: StamperType | undefined;
};

/**
 * Lazy-loaded phone update with loading spinner
 */
export function UpdatePhoneNumber(props: UpdatePhoneNumberProps) {
  return (
    <Suspense
      fallback={
        <div className="tw-flex tw-justify-center tw-items-center tw-py-8">
          <Spinner />
        </div>
      }
    >
      <UpdatePhoneNumberLazy {...props} />
    </Suspense>
  );
}
