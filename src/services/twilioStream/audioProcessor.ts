import { StreamManager } from './streamManager';
import { OpenAIService } from '../openai';
import { ElevenLabsService } from '../elevenlabs';
import { SpeechPunctuationService } from '../speechPunctuation';

export class AudioProcessor {
  // Accumuler l'audio et le traiter lorsqu'il y a une pause
  static async accumulateAndProcessAudio(
    streamSid: string,
    audioPayload: string,
    sendAudioResponse: (audio: string, streamSid: string) => Promise<void>
  ): Promise<void> {
    try {
      const streamData = StreamManager.getStreamData(streamSid);
      
      if (!streamData) {
        console.error(`Aucune donnée trouvée pour le stream ${streamSid}`);
        return;
      }
      
      // Decoder le payload base64 et l'ajouter au buffer
      const audioBytes = Buffer.from(audioPayload, 'base64');
      StreamManager.addAudioToBuffer(streamSid, new Uint8Array(audioBytes));
      
      // Vérifier si on est déjà en train de traiter l'audio
      if (streamData.isProcessing) {
        return;
      }
      
      // Définir un délai pour considérer qu'une pause a été détectée
      setTimeout(async () => {
        const currentData = StreamManager.getStreamData(streamSid);
        // Si on n'est pas encore en train de traiter l'audio, commencer le traitement
        if (currentData && !currentData.isProcessing && currentData.audioBuffer.length > 0) {
          StreamManager.setProcessingState(streamSid, true);
          
          try {
            await this.processAudioAndRespond(
              streamSid,
              currentData.audioBuffer,
              sendAudioResponse
            );
          } finally {
            // Réinitialiser le buffer et l'état de traitement
            StreamManager.clearAudioBuffer(streamSid);
            StreamManager.setProcessingState(streamSid, false);
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
      const streamData = StreamManager.getStreamData(streamSid);
      
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
      
      console.log(`Transcription Whisper réussie: "${userMessage}"`);
      
      if (userMessage.trim()) {
        // Ajouter le message de l'utilisateur à la conversation
        StreamManager.addMessageToConversation(streamSid, "user", userMessage);
        
        // Obtenir la réponse de l'IA via API OpenAI
        const aiResponse = await OpenAIService.chat(
          config.openAIApiKey,
          conversations,
          config.openAIModel
        );
        
        console.log(`Réponse IA générée: "${aiResponse}"`);
        
        // Ajouter la réponse de l'IA à la conversation
        StreamManager.addMessageToConversation(streamSid, "assistant", aiResponse);
        
        // Générer et envoyer l'audio
        await this.generateAndSendAudioResponse(
          streamSid,
          aiResponse,
          sendAudioResponse
        );
      } else {
        console.log("Aucun texte transcrit détecté, aucune réponse générée");
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
      const streamData = StreamManager.getStreamData(streamSid);
      
      if (!streamData) {
        console.error(`Aucune donnée trouvée pour le stream ${streamSid}`);
        return;
      }
      
      const { config } = streamData;
      
      // Optimiser le texte pour une meilleure prononciation téléphonique
      const optimizedText = SpeechPunctuationService.optimizeForPhoneCall(text);
      
      console.log(`Génération de l'audio avec ElevenLabs pour: "${optimizedText}"`);
      
      // Convertir la réponse en audio avec ElevenLabs
      if (config.elevenLabsApiKey && config.voiceId) {
        try {
          const audioResponse = await ElevenLabsService.textToSpeech(
            config.elevenLabsApiKey,
            {
              text: optimizedText,
              voice_id: config.voiceId,
              model_id: "eleven_multilingual_v2"
            }
          );
          
          // Convertir l'audio en base64
          const audioBase64 = await ElevenLabsService.audioToBase64(audioResponse.audioBuffer!);
          
          // Envoyer l'audio au client Twilio
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
