import { useContext } from "react";
import { TurnkeyContext, TurnkeyContextType } from "../contexts/TurnkeyContext";

export const useTurnkey = (): TurnkeyContextType => {
  const context = useContext(TurnkeyContext);
  if (!context) {
    throw new Error("useSession must be used within an SessionProvider");
  }
  return context;
};
