// Service pour l'intégration avec l'API ElevenLabs

export interface TextToSpeechRequest {
    text: string;
    voice_id: string;
    model_id?: string;
    voice_settings?: {
      stability?: number;
      similarity_boost?: number;
      style?: number;
      use_speaker_boost?: boolean;
    };
  }
  
  export interface Voice {
    voice_id: string;
    name: string;
    samples?: Array<{ sample_id: string; file_name: string; mime_type: string; size_bytes: number; hash: string }>;
    category?: string;
    fine_tuning?: { model_id: string; is_allowed_to_fine_tune: boolean; fine_tuning_requested: boolean; finetuning_state: string; verification_attempts?: number; verification_failures?: number; verification_attempts_count?: number; slice_ids?: Array<string>; manual_verification?: boolean; manual_verification_requested?: boolean };
    labels?: Record<string, string>;
    description?: string;
    preview_url?: string;
    available_for_tiers?: Array<string>;
    settings?: { stability: number; similarity_boost: number; style?: number; use_speaker_boost?: boolean };
    sharing?: { status: string; history_item_sample_id?: string; original_voice_id?: string; public_owner_id?: string; liked_by_count?: number; cloned_by_count?: number; whitelisted_emails?: Array<string>; name?: string; labels?: Record<string, string>; description?: string };
  }
  
  export interface TextToSpeechResponse {
    audioUrl: string;
    audioBuffer?: ArrayBuffer;
    processedText?: string;
    issues?: string[];
  }
  
  // Interface pour la réponse de l'API ElevenLabs lors de la récupération des voix
  interface GetVoicesResponse {
    voices: Voice[];
  }
  
  // Interface pour la réponse détaillée d'une voix
  interface GetVoiceResponse extends Voice {
    voice_id: string;
  }
  
  export const ELEVENLABS_MODELS = {
    MULTILINGUAL_V2: "eleven_multilingual_v2",
    TURBO_V2: "eleven_turbo_v2",
  };
  
  export const ElevenLabsService = {
    // Obtenir la liste des voix disponibles
    getVoices: async (apiKey: string): Promise<Voice[]> => {
      try {
        if (!apiKey || apiKey.trim() === "") {
          console.error("Clé API ElevenLabs manquante");
          return [];
        }
  
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Réponse ElevenLabs non OK: Status ${response.status}, message: ${errorText}`);
          throw new Error(`Erreur ElevenLabs: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json() as GetVoicesResponse;
        
        if (data && Array.isArray(data.voices)) {
          return data.voices;
        } else {
          console.error("Format de réponse ElevenLabs inattendu:", data);
          return [];
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des voix ElevenLabs:", error);
        throw error;
      }
    },
    
    // Obtenir le détail d'une voix spécifique
    getVoice: async (apiKey: string, voiceId: string): Promise<Voice> => {
      try {
        if (!apiKey || apiKey.trim() === "") {
          throw new Error("Clé API ElevenLabs manquante");
        }
        
        if (!voiceId || voiceId.trim() === "") {
          throw new Error("ID de voix manquant");
        }
  
        const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Réponse ElevenLabs non OK: Status ${response.status}, message: ${errorText}`);
          throw new Error(`Erreur ElevenLabs: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json() as GetVoiceResponse;
        
        if (data && data.voice_id) {
          return data as Voice;
        } else {
          throw new Error("Format de réponse ElevenLabs inattendu");
        }
      } catch (error) {
        console.error(`Erreur lors de la récupération de la voix ${voiceId}:`, error);
        throw error;
      }
    },
    
    // Convertir du texte en voix
    textToSpeech: async (apiKey: string, request: TextToSpeechRequest): Promise<TextToSpeechResponse> => {
      try {
        if (!apiKey || apiKey.trim() === "") {
          throw new Error("Clé API ElevenLabs manquante");
        }
        
        if (!request.voice_id || request.voice_id.trim() === "") {
          throw new Error("ID de voix manquant dans la requête");
        }
        
        if (!request.text || request.text.trim() === "") {
          throw new Error("Texte manquant dans la requête");
        }
  
        const { text, voice_id, model_id, voice_settings } = request;
        
        // Optimiser le texte pour une meilleure prononciation
        const processedText = text;
        const issues: string[] = [];
        
        const requestBody: any = {
          text,
          model_id: model_id || ELEVENLABS_MODELS.MULTILINGUAL_V2,
          voice_settings: voice_settings || {
            stability: 0.5,
            similarity_boost: 0.75
          }
        };
        
        console.log(`Envoi de la requête TTS à ElevenLabs pour la voix ${voice_id}`);
        
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Réponse ElevenLabs TTS non OK: Status ${response.status}, message: ${errorText}`);
          throw new Error(`Erreur ElevenLabs: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        // Récupérer le flux audio
        const audioBuffer = await response.arrayBuffer();
        
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          throw new Error("Aucune donnée audio reçue d'ElevenLabs");
        }
        
        console.log(`Audio reçu d'ElevenLabs: ${audioBuffer.byteLength} octets`);
        
        // Convertir en blob pour pouvoir l'utiliser comme URL
        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        
        return {
          audioUrl,
          audioBuffer,
          processedText,
          issues
        };
      } catch (error) {
        console.error("Erreur lors de la conversion texte-parole:", error);
        throw error;
      }
    },
    
    // Convertir audio en base64 pour l'API Twilio
    audioToBase64: async (audioBuffer: ArrayBuffer): Promise<string> => {
      try {
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          throw new Error("Buffer audio vide ou invalide");
        }
        
        // Convertir ArrayBuffer en Buffer pour Node.js
        if (typeof Buffer !== 'undefined') {
          return Buffer.from(audioBuffer).toString('base64');
        } else {
          // Pour les environnements de navigateur
          const uint8Array = new Uint8Array(audioBuffer);
          let binaryString = '';
          uint8Array.forEach(byte => {
            binaryString += String.fromCharCode(byte);
          });
          return btoa(binaryString);
        }
      } catch (error) {
        console.error("Erreur lors de la conversion audio en base64:", error);
        throw error;
      }
    }
  };
  