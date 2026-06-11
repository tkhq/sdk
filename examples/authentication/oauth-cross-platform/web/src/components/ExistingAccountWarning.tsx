"use client";

import { DeleteSubOrg } from "./DeleteSubOrg";

export function ExistingAccountWarning() {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <span className="font-semibold">Existing account detected.</span>{" "}
        Secondary platform identities are registered at sign-up time. To add
        additional cross-platform identities, sign up with another account.
        Alternatively, if you are using a test organization you can delete this
        sub-org and sign up again.
      </div>
      <DeleteSubOrg />
    </div>
  );
}
