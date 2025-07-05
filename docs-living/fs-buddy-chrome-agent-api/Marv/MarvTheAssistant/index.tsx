import React from 'react';
import { ChatEngineContextProvider } from '../Context/MarvContext';

import { MarvTheAssistant as MarvTheAssistantWithoutContext } from './components/ChatContainer';

interface MarvTheAssistantProps {
  openAiKey: string | null;
  fsApiKey: string | null;
  initialMessages?: any[];
}
const MarvTheAssistant = (props: MarvTheAssistantProps) => {
  return (
    <ChatEngineContextProvider>
      {props.openAiKey && props.fsApiKey && (
        <MarvTheAssistantWithoutContext
          openAiKey={props.openAiKey}
          fsApiKey={props.fsApiKey}
          initialMessages={props.initialMessages || []}
        />
      )}
      {!props.openAiKey && <span>No OpenAI Api or Formstack Api Key</span>}
    </ChatEngineContextProvider>
  );
};
export { MarvTheAssistant };
