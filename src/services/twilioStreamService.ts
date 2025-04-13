import { OpenAIService, ChatMessage } from './openai';
import { ElevenLabsService } from './elevenlabs';
import { SpeechPunctuationService } from './speechPunctuation';

// Interface pour les paramètres de configuration du stream
export interface TwilioStreamConfig {
  openAIApiKey: string;
  openAIModel: string;
  elevenLabsApiKey: string;
  voiceId: string;
  systemPrompt?: string;
}

// Interface pour les événements du stream
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

export class TwilioStreamService {
  private static activeStreams = new Map<string, {
    conversations: ChatMessage[],
    config: TwilioStreamConfig,
    audioBuffer: Uint8Array[],
    isProcessing: boolean
  }>();

  // Initialiser un nouveau stream
  static initStream(streamSid: string, config: TwilioStreamConfig): void {
    // Créer le message système initial
    const systemPrompt = config.systemPrompt || 
      "Tu es un assistant téléphonique IA. Sois poli, concis et serviable. Réponds en français.";
    
    const conversations: ChatMessage[] = [
      { role: "system", content: systemPrompt }
    ];
    
    this.activeStreams.set(streamSid, {
      conversations,
      config,
      audioBuffer: [],
      isProcessing: false
    });
    
    console.log(`Stream ${streamSid} initialisé avec succès`);
  }

  // Terminer un stream
  static endStream(streamSid: string): boolean {
    return this.activeStreams.delete(streamSid);
  }

  // Générer une réponse TwiML pour démarrer un stream
  static generateStreamTwiML(streamUrl: string, welcomeMessage?: string): string {
    const welcomeMessageTwiML = welcomeMessage 
      ? `<Say voice="woman" language="fr-FR">${SpeechPunctuationService.optimizePunctuation(welcomeMessage)}</Say>` 
      : '';
    
    return `
      <Response>
        ${welcomeMessageTwiML}
        <Connect>
          <Stream url="${streamUrl}" />
        </Connect>
      </Response>
    `;
  }

  // Traiter un message WebSocket entrant
  static async handleWebSocketMessage(
    message: string | Buffer, 
    sendAudioResponse: (audio: string, streamSid: string) => Promise<void>
  ): Promise<void> {
    try {
      // Convertir le message en objet JSON
      const eventData: StreamEvent = typeof message === 'string' 
        ? JSON.parse(message) 
        : JSON.parse(message.toString());
      
      console.log(`Événement stream reçu: ${eventData.event}`);
      
      // Gérer les différents types d'événements
      switch (eventData.event) {
        case 'start':
          console.log(`Stream démarré: ${eventData.start?.streamSid}`);
          if (eventData.start?.streamSid) {
            // Initialiser le stream si ce n'est pas déjà fait
            const streamSid = eventData.start.streamSid;
            if (!this.activeStreams.has(streamSid)) {
              this.initStream(streamSid, {
                openAIApiKey: process.env.OPENAI_API_KEY || "",
                openAIModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
                elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
                voiceId: process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"
              });
              
              // Envoyer un message de bienvenue
              const welcomeMessage = "Bonjour, je suis votre assistant vocal. Comment puis-je vous aider aujourd'hui?";
              const streamData = this.activeStreams.get(streamSid);
              if (streamData) {
                streamData.conversations.push(
                  { role: "assistant", content: welcomeMessage }
                );
                
                // Générer l'audio pour le message de bienvenue
                await this.generateAndSendAudioResponse(
                  streamSid, 
                  welcomeMessage, 
                  sendAudioResponse
                );
              }
            }
          }
          break;
        
        case 'media':
          if (eventData.streamSid && eventData.media?.payload) {
            await this.accumulateAndProcessAudio(
              eventData.streamSid,
              eventData.media.payload,
              sendAudioResponse
            );
          }
          break;
        
        case 'stop':
          console.log(`Stream terminé: ${eventData.streamSid}`);
          if (eventData.streamSid) {
            this.endStream(eventData.streamSid);
          }
          break;
        
        case 'mark':
          console.log(`Marqueur reçu: ${eventData.mark?.name}`);
          break;
          
        default:
          console.log(`Événement non géré: ${eventData.event}`);
      }
    } catch (error) {
      console.error("Erreur lors du traitement du message WebSocket:", error);
    }
  }

  // Accumuler l'audio et le traiter lorsqu'il y a une pause
  private static async accumulateAndProcessAudio(
    streamSid: string,
    audioPayload: string,
    sendAudioResponse: (audio: string, streamSid: string) => Promise<void>
  ): Promise<void> {
    try {
      const streamData = this.activeStreams.get(streamSid);
      
      if (!streamData) {
        console.error(`Aucune donnée trouvée pour le stream ${streamSid}`);
        return;
      }
      
      // Decoder le payload base64 et l'ajouter au buffer
      const audioBytes = Buffer.from(audioPayload, 'base64');
      streamData.audioBuffer.push(new Uint8Array(audioBytes));
      
      // Vérifier si on est déjà en train de traiter l'audio
      if (streamData.isProcessing) {
        return;
      }
      
      // Définir un délai pour considérer qu'une pause a été détectée
      setTimeout(async () => {
        // Si on n'est pas encore en train de traiter l'audio, commencer le traitement
        if (!streamData.isProcessing && streamData.audioBuffer.length > 0) {
          streamData.isProcessing = true;
          
          try {
            await this.processAudioAndRespond(
              streamSid,
              streamData.audioBuffer,
              sendAudioResponse
            );
          } finally {
            // Réinitialiser le buffer et l'état de traitement
            streamData.audioBuffer = [];
            streamData.isProcessing = false;
          }
        }
      }, 1000); // 1 seconde de silence considérée comme une pause
      
    } catch (error) {
      console.error("Erreur lors de l'accumulation audio:", error);
    }
  }

  // Traiter l'audio accumulé et générer une réponse
  private static async processAudioAndRespond(
    streamSid: string,
    audioBuffers: Uint8Array[],
    sendAudioResponse: (audio: string, streamSid: string) => Promise<void>
  ): Promise<void> {
    try {
      const streamData = this.activeStreams.get(streamSid);
      
      if (!streamData) {
        console.error(`Aucune donnée trouvée pour le stream ${streamSid}`);
        return;
      }
      
      const { conversations, config } = streamData;
      
      // Concaténer tous les buffers audio en un seul
      let combinedLength = 0;
      audioBuffers.forEach(buffer => {
        combinedLength += buffer.length;
      });
      
      const combinedBuffer = new Uint8Array(combinedLength);
      let offset = 0;
      
      audioBuffers.forEach(buffer => {
        combinedBuffer.set(buffer, offset);
        offset += buffer.length;
      });
      
      // Convertir le tableau Uint8Array en Blob pour l'API Whisper
      const audioBlob = new Blob([combinedBuffer], { type: 'audio/wav' });
      
      try {
        // Transcrire l'audio en utilisant l'API Whisper d'OpenAI
        console.log("Transcription de l'audio via Whisper...");
        const userMessage = await OpenAIService.transcribeAudio(
          config.openAIApiKey,
          audioBlob,
          {
            model: "gpt-4o-transcribe",
            language: "fr",
            prompt: "Le locuteur parle français. Transcrivez avec précision."
          }
        );
        
        console.log(`Transcription Whisper: "${userMessage}"`);
        
        if (userMessage.trim()) {
          // Ajouter le message de l'utilisateur à la conversation
          conversations.push({ role: "user", content: userMessage });
          
          // Obtenir la réponse de l'IA via API OpenAI
          const aiResponse = await OpenAIService.chat(
            config.openAIApiKey,
            conversations,
            config.openAIModel
          );
          
          console.log(`Réponse IA générée: "${aiResponse}"`);
          
          // Ajouter la réponse de l'IA à la conversation
          conversations.push({ role: "assistant", content: aiResponse });
          
          // Générer et envoyer l'audio
          await this.generateAndSendAudioResponse(
            streamSid,
            aiResponse,
            sendAudioResponse
          );
        }
      } catch (error) {
        console.error("Erreur lors de la transcription ou de la génération de réponse:", error);
      }
      
    } catch (error) {
      console.error("Erreur lors du traitement de l'audio:", error);
    }
  }
  
  // Générer et envoyer une réponse audio
  private static async generateAndSendAudioResponse(
    streamSid: string,
    text: string,
    sendAudioResponse: (audio: string, streamSid: string) => Promise<void>
  ): Promise<void> {
    try {
      const streamData = this.activeStreams.get(streamSid);
      
      if (!streamData) {
        console.error(`Aucune donnée trouvée pour le stream ${streamSid}`);
        return;
      }
      
      const { config } = streamData;
      
      // Optimiser le texte pour une meilleure prononciation
      const optimizedText = SpeechPunctuationService.optimizeForPhoneCall(text);
      
      console.log(`Génération audio avec ElevenLabs: "${optimizedText}"`);
      
      try {
        // Convertir la réponse en audio avec ElevenLabs
        const audioResponse = await ElevenLabsService.textToSpeech(
          config.elevenLabsApiKey,
          {
            text: optimizedText,
            voice_id: config.voiceId,
            model_id: "eleven_multilingual_v2"
          }
        );
        
        if (!audioResponse.audioBuffer) {
          throw new Error("Aucun buffer audio reçu d'ElevenLabs");
        }
        
        // Convertir l'audio en base64
        const audioBase64 = await ElevenLabsService.audioToBase64(audioResponse.audioBuffer);
        
        // Envoyer l'audio au client Twilio
        await sendAudioResponse(audioBase64, streamSid);
        
        console.log(`Réponse audio envoyée pour le stream ${streamSid}`);
      } catch (error) {
        console.error("Erreur lors de la génération audio:", error);
      }
      
    } catch (error) {
      console.error("Erreur lors de la génération de la réponse audio:", error);
    }
  }

  // Valider la signature Twilio (sécurité)
  static validateTwilioSignature(signature: string, url: string, params: Record<string, string>, authToken: string): boolean {
    // TODO: Implémenter la validation de signature Twilio
    // Dans une vraie implémentation, il faudrait vérifier la signature
    // Pour l'instant, on retourne toujours true
    return true;
  }
}
