/**
 * Lazy wrapper for update phone component.
 *
 * Component.tsx imports heavy phone libraries.
 * Without this wrapper, those libraries load for everyone on page load.
 * With lazy loading, they only download when someone triggers the update phone flow.
 *
 * IMPORTANT: This wrapper must be in a separate file from Component.tsx.
 * React.lazy() only creates a separate chunk when importing across files.
 */

import { lazy, Suspense } from "react";
import { Spinner } from "../../design/Spinners";
import type { UpdatePhoneNumberProps } from "./Component";

// Load Component.tsx only when this component renders
const UpdatePhoneNumberLazy = lazy(() =>
  import("./Component").then((module) => ({
    default: module.UpdatePhoneNumber,
  }))
);

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
