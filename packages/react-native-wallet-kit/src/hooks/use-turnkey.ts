import { useContext } from 'react';
import { ClientContext, ClientContextType } from '../types/client';

export const useTurnkey = (): ClientContextType => {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error('useTurnkey must be used within a TurnkeyProvider');
  }
  return context;
};