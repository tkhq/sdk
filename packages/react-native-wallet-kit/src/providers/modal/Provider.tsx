import React, { createContext, useState, ReactNode } from 'react';
import { Dimensions, Platform } from 'react-native';

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
  screenHeight: number;
  isIOS: boolean;
  isAndroid: boolean;
};

export const ModalContext = createContext<ModalContextType | undefined>(
  undefined,
);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalStack, setModalStack] = useState<ModalPage[]>([]);

  // Get screen dimensions
  const { width, height } = Dimensions.get('window');
  
  // React Native is always mobile
  const isMobile = true;
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';

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
        screenHeight: height,
        isIOS,
        isAndroid,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}