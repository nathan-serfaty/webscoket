export interface TwilioStreamConfig {
    openAIApiKey: string;
    openAIModel: string;
    elevenLabsApiKey: string;
    voiceId: string;
    systemPrompt?: string;
  }
  
  export interface StreamData {
    conversations: any[];
    config: TwilioStreamConfig;
    audioBuffer: Uint8Array[];
    isProcessing: boolean;
  }
  
  export interface StreamEvent {
    event: string;
    streamSid?: string;
    accountSid?: string;
    callSid?: string;
    tracks?: string[];
    media?: {
      track?: string;
      chunk?: number;
      timestamp?: number;
      payload?: string; // Base64 audio data
    };
    start?: {
      accountSid?: string;
      callSid?: string;
      streamSid?: string;
      tracks?: string[];
    };
    stop?: {
      accountSid?: string;
    };
    mark?: {
      name?: string;
    };
    [key: string]: any;
  }
  