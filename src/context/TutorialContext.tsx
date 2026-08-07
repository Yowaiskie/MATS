import React, { createContext, useContext, useState } from 'react';
import type { Step } from 'react-joyride';
import { STATUS } from 'react-joyride';

interface TutorialContextType {
  run: boolean;
  steps: Step[];
  startTutorial: (moduleSteps: Step[]) => void;
  stopTutorial: () => void;
  handleJoyrideCallback: (data: any) => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  const startTutorial = (moduleSteps: Step[]) => {
    setSteps(moduleSteps);
    setRun(true);
  };

  const stopTutorial = () => {
    setRun(false);
  };

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
    }
  };

  return (
    <TutorialContext.Provider value={{ run, steps, startTutorial, stopTutorial, handleJoyrideCallback }}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};
