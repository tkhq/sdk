/**
 * Lazy wrapper for phone auth component.
 *
 * Component.tsx imports heavy libraries (react-international-phone, libphonenumber-js).
 * Without this wrapper, those libraries load for everyone on page load.
 * With lazy loading, they only download when someone actually picks phone auth.
 *
 * IMPORTANT: This wrapper must be in a separate file from Component.tsx.
 * React.lazy() only creates a separate chunk when importing across files.
 */

import { lazy, Suspense } from "react";
import { Spinner } from "../../design/Spinners";
import type { PhoneNumberInputProps } from "./Component";

// Load Component.tsx only when this component renders
const PhoneNumberInputLazy = lazy(() =>
  import("./Component").then((module) => ({
    default: module.PhoneNumberInput,
  }))
);

export function PhoneNumberInput(props: PhoneNumberInputProps) {
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
