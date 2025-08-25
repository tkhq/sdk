"use client";

import { useScreenSize } from "@utils";
import { createContext, useState, ReactNode } from "react";

export type ModalPage = {
  key: string;
  content: ReactNode;
  showTitle?: boolean;
  preventBack?: boolean;
};

export type ModalContextType = {
  openModal: (page: ModalPage) => void;
  pushPage: (page: ModalPage) => void;
  popPage: () => void;
  closeModal: () => void;
  modalStack: ModalPage[];
  isMobile: boolean;
  screenWidth: number;
};

export const ModalContext = createContext<ModalContextType | undefined>(
  undefined,
);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalStack, setModalStack] = useState<ModalPage[]>([]);

  const { isMobile, width } = useScreenSize();
  const openModal = (page: ModalPage) => setModalStack([page]);
  const pushPage = (page: ModalPage) =>
    setModalStack((prev) => [...prev, page]);
  const popPage = () => setModalStack((prev) => prev.slice(0, -1));
  const closeModal = () => setModalStack([]);

  return (
    <ModalContext.Provider
      value={{
        openModal,
        pushPage,
        popPage,
        closeModal,
        modalStack,
        isMobile,
        screenWidth: width,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}
