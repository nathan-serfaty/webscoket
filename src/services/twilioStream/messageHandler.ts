import { StreamEvent } from './types';
import { StreamManager } from './streamManager';
import { AudioProcessor } from './audioProcessor';
import { OpenAIService } from '../openai';
import { ElevenLabsService } from '../elevenlabs';
import { SpeechPunctuationService } from '../speechPunctuation';

export class MessageHandler {
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
            if (!StreamManager.getStreamData(streamSid)) {
              StreamManager.initStream(streamSid, {
                openAIApiKey: process.env.OPENAI_API_KEY || "",
                openAIModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
                elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
                voiceId: process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"
              });
              
              // Envoyer un message de bienvenue
              const welcomeMessage = "Bonjour, je suis votre assistant vocal. Comment puis-je vous aider aujourd'hui?";
              StreamManager.addMessageToConversation(streamSid, "assistant", welcomeMessage);
              
              // Générer et envoyer l'audio pour le message de bienvenue
              await this.generateAndSendAudioResponse(
                streamSid,
                welcomeMessage,
                sendAudioResponse
              );
            }
          }
          break;
        
        case 'media':
          if (eventData.streamSid && eventData.media?.payload) {
            await AudioProcessor.accumulateAndProcessAudio(
              eventData.streamSid,
              eventData.media.payload,
              sendAudioResponse
            );
          }
          break;
        
        case 'stop':
          console.log(`Stream terminé: ${eventData.streamSid}`);
          if (eventData.streamSid) {
            StreamManager.endStream(eventData.streamSid);
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
  
  // Générer et envoyer une réponse audio
  private static async generateAndSendAudioResponse(
    streamSid: string,
    text: string,
    sendAudioResponse: (audio: string, streamSid: string) => Promise<void>
  ): Promise<void> {
    try {
      const streamData = StreamManager.getStreamData(streamSid);
      if (!streamData) {
        console.error(`Aucune donnée trouvée pour le stream ${streamSid}`);
        return;
      }
      
      const { config } = streamData;
      
      // Optimiser le texte pour une meilleure prononciation téléphonique
      const optimizedText = SpeechPunctuationService.optimizeForPhoneCall(text);
      
      // Générer l'audio avec ElevenLabs
      if (config.elevenLabsApiKey && config.voiceId) {
        try {
          console.log(`Génération audio avec ElevenLabs: "${optimizedText}"`);
          
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
          
          // Envoyer l'audio au stream
          await sendAudioResponse(audioBase64, streamSid);
          
          console.log(`Réponse audio envoyée pour le stream ${streamSid}`);
        } catch (error) {
          console.error("Erreur lors de la génération audio:", error);
        }
      } else {
        console.warn("Clé ElevenLabs ou voiceId manquants");
      }
    } catch (error) {
      console.error("Erreur lors de la génération de la réponse audio:", error);
    }
  }
}
