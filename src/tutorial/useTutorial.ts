import { useContext } from 'react';
import { TutorialContext, type TutorialContextValue } from './tutorial-context';

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial ต้องอยู่ภายใน <TutorialProvider>');
  return ctx;
}
