type MarvTheAssistantViewState =
  | 'hidden'
  | 'parentContained'
  | 'visible'
  | 'halfScreen'
  | 'fullScreen';

const initialState = {
  MarvTheAssistant: {
    viewState: 'parentContained' as MarvTheAssistantViewState,
  },
  MessageContainer: {
    colorScheme: {
      user: 'blue',
      assistant: 'yellow',
      error: 'red',
      other: 'green',
    },
  },
};
function uiComponentReducer(state = initialState, action: any) {
  //   const newState = { ...state };
  switch (action.type) {
    case 'MarvTheAssistant/SET_VIEW_STATE': {
      const MarvTheAssistant = { ...state.MarvTheAssistant };
      console.log({ 'MarvTheAssistant/SET_VIEW_STATE': { action } });
      MarvTheAssistant.viewState = action.payload.MarvTheAssistant.viewState;
      return { ...state, ...{ MarvTheAssistant } };
    }
    case 'MessageContainer/ColorScheme/UPDATE': {
      const MessageContainer = { ...state.MessageContainer };

      console.log({ 'MessageContainer/ColorScheme/UPDATE': { action } });
      MessageContainer.colorScheme = action.payload.colorScheme;
      return {
        ...state,
        ...{ MessageContainer },
      };
    }
    default:
      return state;
  }
}

const selectors = {
  getViewState: (state: any) => {
    return state.uiComponents.MarvTheAssistant.viewState;
  },
  getMessageContainerColors: (state: any) => {
    return state.uiComponents.MessageContainer.colorScheme;
  },
};
export { selectors };
export { uiComponentReducer };
