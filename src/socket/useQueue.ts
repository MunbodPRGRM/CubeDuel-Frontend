import { useContext } from 'react';
import { QueueContext, type QueueContextValue } from './queue-context';

export function useQueue(): QueueContextValue {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue ต้องอยู่ภายใน <QueueProvider>');
  return ctx;
}
