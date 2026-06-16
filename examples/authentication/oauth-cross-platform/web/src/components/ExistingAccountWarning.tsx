"use client";

import { DeleteSubOrg } from "./DeleteSubOrg";

export function ExistingAccountWarning() {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <span className="font-semibold">Existing account detected.</span>{" "}
        Secondary platform identities were not registered at sign-up time. The
        app will attempt to link them automatically if the client IDs are
        defined in the `.env.local`. Alternatively, if you are using a test
        organization and want to go through the sign up flow again you can
        delete this sub-org.
      </div>
      <DeleteSubOrg />
    </div>
  );
}
