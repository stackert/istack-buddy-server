import { store } from '../../../state';
import { Provider as ReduxProvider } from 'react-redux';
import { getRobotInstanceFactoryMarv } from '../../../RobotProfiles';

import React from 'react';
import { ChatContainer } from './ChatContainer';
import { TChatMessage } from './types';

interface MarvTheAssistantProps {
  fsApiKey?: string;
  openAiKey: string;
  initialMessages: TChatMessage[];
}
const MarvTheAssistant = (params: MarvTheAssistantProps) => {
  return (
    <ReduxProvider store={store}>
      <ChatContainer {...params} />
    </ReduxProvider>
  );
};

export { MarvTheAssistant };
