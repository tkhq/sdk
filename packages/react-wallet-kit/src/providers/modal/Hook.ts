"use client";

import { useContext } from "react";
import { ModalContext, ModalContextType } from "./Provider";

/** @internal */
export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) throw new Error("useModal must be used within ModalProvider");
  return context;
};
