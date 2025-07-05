import { Chat } from 'openai/resources';
import React, {
  createContext,
  useContext,
  ReactNode,
  SetStateAction,
  Dispatch,
  useState,
} from 'react';
import { getRobotInstanceFactoryMarv } from '../RobotProfiles';

import { ChatEngine } from '../ChatEngine';
import { IRobotInstructionSet } from '../robot-instruction-set/IRobotInstructionSet';

let robotInstance: ChatEngine;

interface StateContextType {
  setRobotInstance: (chatEngine: ChatEngine) => void;
  getRobotInstance: () => ChatEngine;
}

type ContextProviderProps = {
  children?: ReactNode;
};

const accessors = {
  setRobotInstance: (chatEngine: ChatEngine) => {
    robotInstance = chatEngine;
  },
  getRobotInstance: () => robotInstance,
};

const ChatEnginContext = createContext<StateContextType>(accessors);

export const ChatEngineContextProvider = ({
  children,
}: ContextProviderProps) => {
  return (
    <ChatEnginContext.Provider value={{ ...accessors }}>
      {children}
    </ChatEnginContext.Provider>
  );
};

export const useChatEngineContext = () => useContext(ChatEnginContext);

// --------------------
