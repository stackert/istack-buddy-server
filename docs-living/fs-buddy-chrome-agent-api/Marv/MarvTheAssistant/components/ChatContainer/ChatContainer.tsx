import React, { useEffect } from 'react';
import { ConversationDisplay } from './ConversationDisplay';
import { UserChatInput } from './UserChatInput';
import { selectors } from '../../../state/ui-components.state';
import { useChatEngineContext } from '../../../Context/MarvContext';
import { getRobotInstanceFactoryMarv } from '../../../RobotProfiles';
import { messageActions } from '../../../state/EntityAdapter';
import { store } from '../../../state';

import './ChatContainer.css';
import { useSelector } from 'react-redux';
import { ChatEngine } from '../../../ChatEngine';
import { TChatMessage } from './types';
import { ThreadMessage } from 'openai/resources/beta/threads/messages/messages';

interface ChatContainerProps {
  openAiKey: string;
  initialMessages?: TChatMessage[];
  fsApiKey?: string;
}

const ChatContainer: React.FC<ChatContainerProps> = (
  params: ChatContainerProps
) => {
  const { setRobotInstance } = useChatEngineContext();
  const viewState = useSelector(selectors.getViewState);
  const getRobotInstanceMarv = getRobotInstanceFactoryMarv({
    // I dont think we're hurting anything doing it this way..
    // this really needs to be a service
    initialMessages: [], // params.initialMessages || [],
    apiKey: params.openAiKey,
    fsApiKey: params.fsApiKey,
  });

  try {
    getRobotInstanceMarv().then((marv) => {
      setRobotInstance(marv);
    });
  } catch (e) {
    console.error({
      message: 'Failed to getRobotInstanceMarv or set instance.',
    });
  }

  return (
    <div
      className={
        viewState === 'fullScreen' ? 'full-screen' : 'parent-contained'
      }
    >
      <div
        style={{
          height: '100%',
        }}
      >
        <ConversationDisplay />
        <UserChatInput initialMessages={params.initialMessages} />
      </div>
    </div>
  );
};

export { ChatContainer };
