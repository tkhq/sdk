/**
 * Lazy-loaded wrapper for PhoneNumberInput component
 * This ensures the phone auth screen and all its dependencies
    including phone libraries) are only loaded when user selects phone authentication.
 */

import { lazy, Suspense } from "react";
import { Spinner } from "../design/Spinners";

// Dynamically import Phone component only when needed
const PhoneNumberInputLazy = lazy(() =>
  import("./Phone").then((module) => ({
    default: module.PhoneNumberInput,
  }))
);

/**
 * Lazy-loaded phone auth with loading spinner
 */
export function PhoneNumberInput(props: { onContinue?: (phone: string, formattedPhone: string) => void }) {
  return (
    <Suspense
      fallback={
        <div className="tw-flex tw-justify-center tw-items-center tw-py-8">
          <Spinner />
        </div>
      }
    >
      <PhoneNumberInputLazy {...props} />
    </Suspense>
  );
}
