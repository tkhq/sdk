"use client";

import { useScreenSize } from "../../utils/utils";
import { createContext, useState, ReactNode } from "react";

export type ModalPage = {
  key: string;
  content: ReactNode;
  showTitle?: boolean;
  preventBack?: boolean;
};

export type ModalContextType = {
  openModal: (page: ModalPage) => void;
  openSheet: (page: ModalPage) => void;
  pushPage: (page: ModalPage) => void;
  popPage: () => void;
  closeModal: () => void;
  closeSheet: () => void;
  modalStack: ModalPage[];
  sheet: ModalPage | null;
  isMobile: boolean;
  screenWidth: number;
};

export const ModalContext = createContext<ModalContextType | undefined>(
  undefined,
);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalStack, setModalStack] = useState<ModalPage[]>([]);
  const [sheet, setSheet] = useState<ModalPage | null>(null);

  const { isMobile, width } = useScreenSize();
  const openModal = (page: ModalPage) => setModalStack([page]);
  const openSheet = (page: ModalPage) => setSheet(page);
  const pushPage = (page: ModalPage) =>
    setModalStack((prev) => [...prev, page]);
  const popPage = () => setModalStack((prev) => prev.slice(0, -1));
  const closeModal = () => {
    setModalStack([]);
    setSheet(null);
  };
  const closeSheet = () => setSheet(null);

  return (
    <ModalContext.Provider
      value={{
        openModal,
        openSheet,
        pushPage,
        popPage,
        closeModal,
        closeSheet,
        modalStack,
        sheet,
        isMobile,
        screenWidth: width,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}
