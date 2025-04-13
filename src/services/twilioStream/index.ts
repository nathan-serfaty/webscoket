export * from './types';
export * from './streamManager';
export * from './audioProcessor';
export * from './messageHandler';

import { StreamManager } from './streamManager';
import { MessageHandler } from './messageHandler';

export const TwilioStreamService = {
  initStream: StreamManager.initStream,
  endStream: StreamManager.endStream,
  generateStreamTwiML: StreamManager.generateStreamTwiML,
  handleWebSocketMessage: MessageHandler.handleWebSocketMessage,
  validateTwilioSignature: StreamManager.validateTwilioSignature
};
