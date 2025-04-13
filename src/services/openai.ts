// Service pour l'intégration avec l'API OpenAI (ChatGPT)

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }
  
  export interface ChatCompletionRequest {
    messages: ChatMessage[];
    model: string;
    temperature?: number;
    max_tokens?: number;
  }
  
  export interface TranscriptionResponse {
    text: string;
  }
  
  export const OPENAI_MODELS = {
    GPT_4O: "gpt-4o",
    GPT_4O_MINI: "gpt-4o-mini", 
    GPT_4_TURBO: "gpt-4-turbo",
    GPT_3_5_TURBO: "gpt-3.5-turbo",
  };
  
  export const OpenAIService = {
    // Générer une transcription via l'API Whisper
    transcribeAudio: async (
      apiKey: string,
      audioData: Blob | File,
      options?: {
        model?: string;
        prompt?: string;
        language?: string;
      }
    ): Promise<string> => {
      if (!apiKey || apiKey.length < 20) {
        throw new Error("Clé API OpenAI invalide");
      }
      
      try {
        const formData = new FormData();
        formData.append('file', audioData);
        formData.append('model', options?.model || 'gpt-4o-transcribe');
        
        if (options?.prompt) {
          formData.append('prompt', options.prompt);
        }
        
        if (options?.language) {
          formData.append('language', options.language);
        }
        
        console.log(`Envoi de la requête de transcription à Whisper avec modèle: ${options?.model || 'gpt-4o-transcribe'}`);
        
        // Appeler l'API Whisper d'OpenAI
        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Erreur API Whisper: Status ${response.status}, Message: ${JSON.stringify(errorData)}`);
          throw new Error(`Erreur API OpenAI Whisper: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        
        const data = await response.json() as TranscriptionResponse;
        
        // S'assurer que le format de la réponse contient un texte
        if (data && typeof data.text === 'string') {
          return data.text;
        } else {
          console.error("Format de réponse Whisper inattendu:", data);
          return "";
        }
      } catch (error) {
        console.error("Erreur lors de la transcription audio:", error);
        throw error;
      }
    },
  
    // Génération de réponse via l'API ChatGPT
    generateCompletion: async (
      apiKey: string, 
      request: ChatCompletionRequest
    ): Promise<{ text: string; fullResponse: any }> => {
      // Valider la clé API
      if (!apiKey || apiKey.length < 20) {
        throw new Error("Clé API OpenAI invalide");
      }
      
      try {
        // Déterminer si la clé est une clé de projet ou une clé normale
        const isProjectKey = apiKey.startsWith('sk-proj-');
        
        // URL de l'API (même URL pour les deux types de clés)
        const apiUrl = "https://api.openai.com/v1/chat/completions";
        
        // En-têtes (différents pour les clés de projet)
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        
        // Ajouter l'en-tête OpenAI-Beta uniquement pour les clés de projet
        if (isProjectKey) {
          headers['OpenAI-Beta'] = 'assistants=v1';
        }
        
        const requestBody = {
          model: request.model || OPENAI_MODELS.GPT_4O_MINI,
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.max_tokens || 2000
        };
        
        console.log(`Envoi de la requête à l'API ChatGPT avec modèle: ${requestBody.model}`);
        
        // Appeler l'API OpenAI
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Erreur API OpenAI: Status ${response.status}, Message: ${JSON.stringify(errorData)}`);
          throw new Error(`Erreur API OpenAI: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        
        interface ChatCompletionResponse {
          choices: Array<{
            message?: {
              content: string;
            };
            delta?: {
              content: string;
            };
          }>;
        }
        
        const data = await response.json() as ChatCompletionResponse;
        
        // Extraire le texte de la réponse
        const text = data.choices && data.choices[0] && data.choices[0].message 
          ? data.choices[0].message.content
          : "";
        
        return {
          text,
          fullResponse: data
        };
      } catch (error) {
        console.error("Erreur lors de l'appel à l'API OpenAI:", error);
        throw error;
      }
    },
    
    // Fonction de chat avec historique de conversation
    chat: async (
      apiKey: string,
      messages: ChatMessage[],
      model: string = OPENAI_MODELS.GPT_4O_MINI
    ): Promise<string> => {
      try {
        const result = await OpenAIService.generateCompletion(apiKey, {
          messages,
          model
        });
        
        return result.text;
      } catch (error) {
        console.error("Erreur lors de l'appel à l'API chat:", error);
        throw error;
      }
    }
  };
  