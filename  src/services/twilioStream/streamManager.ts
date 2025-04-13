import { TwilioStreamConfig, StreamData, StreamEvent } from './types';
import { SpeechPunctuationService } from '../speechPunctuation';

export class StreamManager {
  private static activeStreams = new Map<string, StreamData>();

  // Initialiser un nouveau stream
  static initStream(streamSid: string, config: TwilioStreamConfig): void {
    // Créer le message système initial
    const systemPrompt = config.systemPrompt || 
      "Tu es un assistant téléphonique IA. Sois poli, concis et serviable. Réponds en français.";
    
    const conversations = [
      { role: "system" as const, content: systemPrompt }
    ];
    
    this.activeStreams.set(streamSid, {
      conversations,
      config,
      audioBuffer: [],
      isProcessing: false
    });
    
    console.log(`Stream ${streamSid} initialisé avec succès`);
  }

  // Obtenir les données d'un stream
  static getStreamData(streamSid: string): StreamData | undefined {
    return this.activeStreams.get(streamSid);
  }

  // Mettre à jour les données d'un stream
  static updateStreamData(streamSid: string, data: Partial<StreamData>): void {
    const streamData = this.activeStreams.get(streamSid);
    if (streamData) {
      this.activeStreams.set(streamSid, { ...streamData, ...data });
    }
  }

  // Ajouter un message à la conversation
  static addMessageToConversation(
    streamSid: string, 
    role: 'user' | 'assistant', 
    content: string
  ): void {
    const streamData = this.activeStreams.get(streamSid);
    if (streamData) {
      streamData.conversations.push({ role, content });
      this.activeStreams.set(streamSid, streamData);
    }
  }

  // Ajouter des données audio au buffer
  static addAudioToBuffer(streamSid: string, audioData: Uint8Array): void {
    const streamData = this.activeStreams.get(streamSid);
    if (streamData) {
      streamData.audioBuffer.push(audioData);
      this.activeStreams.set(streamSid, streamData);
    }
  }

  // Vider le buffer audio
  static clearAudioBuffer(streamSid: string): void {
    const streamData = this.activeStreams.get(streamSid);
    if (streamData) {
      streamData.audioBuffer = [];
      this.activeStreams.set(streamSid, streamData);
    }
  }

  // Définir l'état de traitement
  static setProcessingState(streamSid: string, isProcessing: boolean): void {
    const streamData = this.activeStreams.get(streamSid);
    if (streamData) {
      streamData.isProcessing = isProcessing;
      this.activeStreams.set(streamSid, streamData);
    }
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

  // Valider la signature Twilio (sécurité)
  static validateTwilioSignature(signature: string, url: string, params: Record<string, string>, authToken: string): boolean {
    // TODO: Implémenter la validation de signature Twilio
    // Dans une vraie implémentation, il faudrait vérifier la signature
    // Pour l'instant, on retourne toujours true
    return true;
  }
}
