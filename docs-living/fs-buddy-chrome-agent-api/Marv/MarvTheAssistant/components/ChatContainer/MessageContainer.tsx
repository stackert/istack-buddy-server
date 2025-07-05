import { Card } from 'primereact/card';
import React from 'react';
import { useSelector } from 'react-redux';
import { ImageFile } from '../ImageFile';
import './MessageContainer.css';
import { TChatMessage } from './types';
import { selectors } from '../../../state/ui-components.state';
import { ColorScheme } from './ColorScheme';
import { useChatEngineContext } from '../../../Context/MarvContext';

const showdown = require('showdown');
const converter = new showdown.Converter();

type MessageAuthorRoles = 'user' | 'assistant' | 'error' | 'other' | 'guest';
type MessageContainerColorScheme = {
  [role in MessageAuthorRoles]: string;
};

const roleColors: MessageContainerColorScheme = {
  user: '#daeaf7',
  assistant: '#e7c8e7',
  error: '#FFAEBC',
  other: '#f0f0f0',
  guest: '#f0f0f0',
};

interface MessageContainerProps {
  message: TChatMessage;
}

const MessageContainer: React.FC<MessageContainerProps> = ({ message }) => {
  //
  const containerColors = useSelector(
    selectors.getMessageContainerColors
  ) as MessageContainerColorScheme;

  return (
    <Card
      subTitle={message.role}
      className="MessageContainer"
      style={{
        backgroundColor: roleColors[message.role],
        // message.role === "user" ? userRoleColor : nonuserRoleColor,
      }}
    >
      <div className="MessageContainer">
        <div
          className="MessageContainerContent"
          dangerouslySetInnerHTML={{
            __html: messageToMessageHtml(message),
          }}
        ></div>
        {Array.isArray(message.imageFiles) && (
          <div style={{ height: '20%' }}>
            {message.imageFiles.map((imageFile) => (
              <ImageFile fileId={imageFile.fileId} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
const messageToMessageHtml = (message: TChatMessage) => {
  switch (message.role) {
    case 'assistant':
      return converter.makeHtml(message.contentText);
    case 'user':
      return message.contentText.replace(/\n/g, '<br />');
    default:
      return message.contentText;
  }
};
export default MessageContainer;
