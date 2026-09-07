import { useContext } from 'react';
import { SocketContext, type SocketContextValue } from './socket-context';

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket ต้องอยู่ภายใน <SocketProvider>');
  return ctx;
}
