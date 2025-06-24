type TRobotMessage = {
  role: 'user' | 'assistant';
  content: string;
  content_type: 'text' | 'image_url';
  created_at: string; // ISO 8601 - inclusive of milliseconds if possible '2025-06-20T04:13:55.419Z'
};

type TMessageEnvelopePayload = {
  messages: TRobotMessage[]; // this should be in order, but can be sorted with creation_date
  // there will be several message, the most recent message is the  'new' message
  // eg: lastIndex is the one most interesting
};
// type TRobotMessageResponse = {
//   message: string;
//   sender: string;
// };

type TMessageEnvelope<T = TMessageEnvelopePayload> = {
  routerId: string;
  messageType: 'message' | 'response';
  payload?: T;
};

export type { TRobotMessage, TMessageEnvelope };
