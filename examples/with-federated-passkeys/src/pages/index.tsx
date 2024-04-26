import React from "react";
import { useState } from "react";
import Home from "./home";

import { TurnkeyProvider } from "@turnkey/sdk-react";

export default function Index() {

  return (
    <div className="wrapper">
      <TurnkeyProvider config={{
        apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
        defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!
      }}>
        <Home />
      </TurnkeyProvider>
    </div>
  );

}
