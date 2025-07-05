import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { chatMessagesSelectors } from '../../../state/ChatSelectors';
import MessageContainer from './MessageContainer';
import { ScrollPanel } from 'primereact/scrollpanel';
import './ConversationDisplay.css';
import { ChatEngine } from '../../../ChatEngine';
import { TChatMessage } from './types';
import { useChatEngineContext } from '../../../Context/MarvContext';
interface ConversationDisplayProps {
  // messages: TChatMessage[];
}

const ConversationDisplay: React.FC<ConversationDisplayProps> = (params) => {
  const marvConversationRef = useRef(null);
  const { getRobotInstance } = useChatEngineContext();

  const chatMessages = useSelector(
    chatMessagesSelectors.selectAll
  ) as TChatMessage[];

  useEffect(() => {
    scrollConversationToBottom();
  }, [chatMessages]);

  const scrollConversationToBottom = () => {
    if (marvConversationRef.current) {
      // @ts-ignore
      marvConversationRef.current?.scrollIntoView({
        behavior: 'smooth',
        // block: "end",
        block: 'start',
        inline: 'nearest',
      });
    }
  };

  return (
    <ScrollPanel
      style={{
        textAlign: 'center',
        width: '100%',
        height: '70%',
        // paddingLeft: "15px",
      }}
    >
      {chatMessages.map((message, index) => (
        <div key={message.messageId} style={{ textAlign: 'center' }}>
          {index === chatMessages.length - 1 && (
            <div ref={marvConversationRef}></div>
          )}
          <MessageContainer message={message} />
        </div>
      ))}
    </ScrollPanel>
  );
};

export { ConversationDisplay };
