import { useContext } from "react";
import { ClientContext, ClientContextType } from "./Types";

export const useTurnkey = (): ClientContextType => {
  const context = useContext(ClientContext);
  if (!context)
    throw new Error("useTurnkey must be used within TurnkeyProvider");
  return context;
};
