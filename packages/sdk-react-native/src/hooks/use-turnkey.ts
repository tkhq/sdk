import { useContext } from "react";
import { TurnkeyContext, TurnkeyContextType } from "../contexts/TurnkeyContext";

export const useTurnkey = (): TurnkeyContextType => {
  const context = useContext(TurnkeyContext);
  if (!context) {
    throw new Error("useTurnkey must be used within an TurnkeyProvider");
  }
  return context;
};
