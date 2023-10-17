"use client";

import { IframeStamper } from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface ExportProps {
  iframeUrl: string;
  turnkeyBaseUrl: string;
}

const TurnkeyIframeContainerId = "turnkey-iframe-container-id";

export function Export(props: { iframeStamper: IframeStamper | null, turnkeyBaseUrl: string }) {
  return (
    <div style={{ display: "none" }} id={TurnkeyIframeContainerId}></div>
  );
}
