type TSupportedContentTypes =
  | 'text/plain'
  | 'image/jpg'
  | 'image/gif'
  | 'image/*'
  | 'application/octet-stream'
  | 'application/json';

type TConversationItemAuthorRoles =
  | 'cx-customer'
  | 'cx-agent'
  | 'cx-robot' // for robot messages that are shared with the customer
  | 'cx-supervisor'
  | 'robot'
  | 'conversation-admin' // for inserting additional instructions7
  | 'tool'
  | 'admin';

type TConversationListItem = {
  id: string;
  authorId: string; // at this time we don't have an 'id' for author.  Not sure how will deal with 'author' identity of users are anonymous.
  authorRole: TConversationItemAuthorRoles;
  content: {
    type: TSupportedContentTypes;
    payload: any;
  };

  createdAt: Date;
  updatedAt: Date;
  estimatedTokenCount: number;

  //  "TConversationListItem" will have different visibilities
  // admin/cx-agent will likely see all messages
  // "customer"/users will see most message (all between them and their cx-rep)
  //  cx-agent may choose to "share" a robot message with the customer (we'll duplicate the message in those cases)
  roleVisibilities: TConversationItemAuthorRoles[];
};

export type {
  TConversationListItem,
  TConversationItemAuthorRoles,
  TSupportedContentTypes,
};
