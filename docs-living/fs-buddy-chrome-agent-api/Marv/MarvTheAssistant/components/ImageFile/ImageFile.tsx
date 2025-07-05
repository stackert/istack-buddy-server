import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { waitFetchMarvFile, store, fileCacheActions } from '../../../state';
import { fileCacheSelectors } from '../../../state/FileCacheSelectors';

import './ImageFile.css';
import { ChatEngine } from '../../../ChatEngine';
import { useChatEngineContext } from '../../../Context/MarvContext';

interface ImageFileProps {
  fileId: string;
}

const ImageFile: React.FC<ImageFileProps> = ({ fileId }) => {
  const { getRobotInstance } = useChatEngineContext();
  const theImageFile = useSelector((state: any) => {
    return fileCacheSelectors.selectById(state, fileId);
  });

  useEffect(() => {
    theImageFile &&
      theImageFile.base64 === null &&
      store
        .dispatch(
          waitFetchMarvFile({
            fileId: fileId,
            targetMessageId: '_NOT_IN_USE_AT_THIS_TIME_targetMessageId_',
            getRobotInstance: getRobotInstance,
          })
        )
        .unwrap()
        .then(async ({ fileId, base64 }) => {
          store.dispatch(
            fileCacheActions.updateImageBase64({
              id: fileId,
              changes: { base64: `data:image/png;base64,${base64}` },
            })
          );
        })
        .catch((rejectedValueOrSerializedError) => {
          // *tmc* - need to handle this error,  Create a message to the user - "API Broke, bad network, bad credentials, etc."
          console.log({
            rejectedValueOrSerializedError:
              rejectedValueOrSerializedError || null,
          });
        });
  }, [theImageFile]); // [theImageFile.base64]
  return (
    <div className={'message-image-container'}>
      {/* theImageFile: {JSON.stringify(theImageFile)} <br /> */}
      {theImageFile &&
        'base64' in theImageFile &&
        theImageFile.base64 !== null && (
          <img
            style={{ height: '85%', width: '85%' }}
            src={theImageFile?.base64 || ''}
            alt={fileId}
          />
        )}
    </div>
  );
};

export { ImageFile };
