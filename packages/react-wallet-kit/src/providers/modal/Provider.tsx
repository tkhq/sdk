import { useScreenSize } from "@utils";
import { createContext, useContext, useState, ReactNode } from "react";

export type ModalPage = {
  key: string;
  content: ReactNode;
  showTitle?: boolean;
  preventBack?: boolean;
};

type ModalContextType = {
  openModal: (page: ModalPage) => void;
  pushPage: (page: ModalPage) => void;
  popPage: () => void;
  closeModal: () => void;
  modalStack: ModalPage[];
  isMobile: boolean;
  screenWidth: number;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) throw new Error("useModal must be used within ModalProvider");
  return context;
};

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
