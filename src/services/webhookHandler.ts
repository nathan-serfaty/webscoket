import { ElevenLabsAgentService, AgentWebhookResponse } from './elevenLabsAgent';
import { TwilioStreamService } from './twilioStreamService';

export class WebhookHandler {
  // Traiter un webhook Twilio
  static async handleTwilioWebhook(
    requestBody: any,
    options: {
      openAIApiKey: string;
      elevenLabsApiKey: string;
      voiceId: string;
      openAIModel: string;
      callbackUrl?: string;
      streamUrl?: string; // URL du WebSocket pour le streaming
      useStreaming?: boolean; // Option pour activer le streaming
    }
  ): Promise<AgentWebhookResponse> {
    try {
      // Si le streaming est activé, générer une réponse TwiML de stream
      if (options.useStreaming && options.streamUrl) {
        console.log("Utilisation du mode streaming pour la réponse");
        
        // Message de bienvenue
        const welcomeMessage = "Bonjour, je suis votre assistant vocal. Comment puis-je vous aider aujourd'hui?";
        
        // Générer la réponse TwiML pour démarrer le stream
        const twiml = TwilioStreamService.generateStreamTwiML(
          options.streamUrl,
          welcomeMessage
        );
        
        return {
          callSid: requestBody?.CallSid || "unknown",
          userMessage: "",
          agentResponse: welcomeMessage,
          success: true,
          twiml: twiml // Ajout de la réponse TwiML directement dans la réponse
        };
      }
      
      // Sinon, utiliser le gestionnaire classique
      return await ElevenLabsAgentService.handleTwilioWebhook(requestBody, options);
    } catch (error) {
      console.error("Erreur dans le handler webhook:", error);
      return {
        callSid: requestBody?.CallSid || "unknown",
        userMessage: requestBody?.SpeechResult || "",
        agentResponse: "Une erreur est survenue lors du traitement de votre message.",
        success: false
      };
    }
  }
  
  // Générer une réponse TwiML pour Twilio
  static generateTwiMLResponse(text: string, options?: {
    language?: string;
    voice?: string;
    gather?: boolean;
    actionUrl?: string;
    timeout?: number;
    useStreaming?: boolean;
    streamUrl?: string;
  }): string {
    // Si le streaming est activé, utiliser la réponse TwiML de streaming
    if (options?.useStreaming && options?.streamUrl) {
      return TwilioStreamService.generateStreamTwiML(options.streamUrl, text);
    }
    
    // Sinon, utiliser la réponse TwiML classique
    const language = options?.language || "fr-FR";
    const voice = options?.voice || "woman";
    const gather = options?.gather !== false;
    const actionUrl = options?.actionUrl || "/api/twilio-webhook";
    const timeout = options?.timeout || 3;
    
    if (gather) {
      return `
        <Response>
          <Say voice="${voice}" language="${language}">${text}</Say>
          <Gather input="speech" timeout="${timeout}" action="${actionUrl}" method="POST" language="${language}">
            <Say voice="${voice}" language="${language}">Je vous écoute.</Say>
          </Gather>
          <Redirect>${actionUrl}</Redirect>
        </Response>
      `;
    } else {
      return `
        <Response>
          <Say voice="${voice}" language="${language}">${text}</Say>
        </Response>
      `;
    }
  }
}
