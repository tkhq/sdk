"use client";

import { useScreenSize } from "../../utils/utils";
import { createContext, useState, ReactNode, ComponentType } from "react";

export type ModalPage = {
  key: string;
  content: ReactNode;
  showTitle?: boolean;
  showTurnkeyBranding?: boolean;
  preventBack?: boolean;
  onClose?: () => void;
  /** A context provider component that wraps all pages in the modal stack. Only applies from the root page. */
  contextProvider?: ComponentType<{ children: ReactNode }>;
};

export type ModalContextType = {
  openModal: (page: ModalPage) => void;
  openSheet: (page: ModalPage) => void;
  pushPage: (page: ModalPage) => void;
  popPage: () => void;
  popPages: (count: number) => void;
  popToPage: (key: string) => void;
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
  const popPages = (count: number) =>
    setModalStack((prev) => prev.slice(0, Math.max(0, prev.length - count)));
  const popToPage = (key: string) =>
    setModalStack((prev) => {
      let index = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i]?.key === key) {
          index = i;
          break;
        }
      }
      if (index === -1) return prev;
      return prev.slice(0, index + 1);
    });
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
        popPages,
        popToPage,
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
