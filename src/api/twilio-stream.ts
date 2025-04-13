import { TwilioStreamConfig } from '../services/twilioStreamService';

export async function handleTwilioStream(request: Request) {
  console.log("[TWILIO-STREAM] Initialisation du stream API", request.url);
  
  try {
    const streamConfig: TwilioStreamConfig = {
      openAIApiKey: process.env.OPENAI_API_KEY || "your-openai-api-key",
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "your-elevenlabs-api-key",
      voiceId: process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL",
      openAIModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      systemPrompt: "Tu es un assistant téléphonique IA. Réponds de manière concise et utile. Parle en français."
    };
    
    // Determine WebSocket URL based on request URL
    const url = new URL(request.url);
    const host = request.headers.get('host') || url.host || 'localhost:8080';
    
    // Determine protocol (ws or wss) based on request protocol
    const isSecure = url.protocol === 'https:';
    const wsProtocol = isSecure ? 'wss' : 'ws';
    
    // Build proper WebSocket URL
    const wsUrl = `${wsProtocol}://${host}/twilio-stream`;
    
    console.log(`[TWILIO-STREAM] URL de requête: ${request.url}`);
    console.log(`[TWILIO-STREAM] Hôte détecté: ${host}`);
    console.log(`[TWILIO-STREAM] Protocole sécurisé: ${isSecure}`);
    console.log(`[TWILIO-STREAM] WebSocket URL configurée: ${wsUrl}`);
    
    // Alternative URLs to try if the main one doesn't work
    const alternativeUrls = [
      `${wsProtocol}://${host}/twilio-stream`,
      `ws://${host}/twilio-stream`, 
      `wss://${host}/twilio-stream`,
      `ws://localhost:8080/twilio-stream`
    ];
    
    console.log(`[TWILIO-STREAM] URLs alternatives qui pourraient fonctionner:`, alternativeUrls);
    
    return new Response(JSON.stringify({
      status: "success",
      message: "WebSocket server configuré et prêt à recevoir des connexions",
      wsUrl: wsUrl,
      alternativeUrls: alternativeUrls
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error("[TWILIO-STREAM] Erreur lors de la configuration du stream:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      message: "Erreur lors de la configuration du WebSocket",
      error: error instanceof Error ? error.message : String(error)
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}

export default handleTwilioStream;
