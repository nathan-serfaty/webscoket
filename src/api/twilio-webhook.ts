import { WebhookHandler } from '../services/webhookHandler';

// Fonction pour gérer les webhooks Twilio
export async function handleTwilioWebhook(request: Request) {
  try {
    console.log("Webhook Twilio reçu", request.url);
    
    // Vérifier le type de contenu de la requête
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, any> = {};
    
    if (contentType.includes('application/json')) {
      // Traiter le JSON
      body = await request.json();
      console.log("Corps JSON reçu:", body);
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      // Récupérer les données du formulaire
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value;
      });
      console.log("Corps form-data reçu:", body);
    } else {
      // Essayer de récupérer le texte brut
      const text = await request.text();
      console.log("Contenu brut de la requête:", text);
      
      // Tenter de parser comme URL-encoded
      try {
        const params = new URLSearchParams(text);
        params.forEach((value, key) => {
          body[key] = value;
        });
        console.log("Corps URL-encoded parsé:", body);
      } catch (e) {
        console.error("Impossible de parser le contenu de la requête:", e);
      }
    }
    
    console.log("Corps du webhook complet:", body);
    console.log("CallSid:", body.CallSid);
    console.log("SpeechResult:", body.SpeechResult);
    
    // URL pour le WebSocket basée sur l'URL actuelle
    const origin = new URL(request.url).origin;
    const webhookUrl = `${origin}/api/twilio-webhook`;
    const streamUrl = `${origin.replace('http', 'ws')}/twilio-stream`;
    
    console.log("URLs configurées - Webhook:", webhookUrl);
    console.log("URLs configurées - Stream:", streamUrl);
    
    // Récupérer les options depuis l'environnement
    const options = {
      openAIApiKey: process.env.OPENAI_API_KEY || "your-openai-api-key",
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "your-elevenlabs-api-key",
      voiceId: process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL", // Sarah par défaut
      openAIModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      callbackUrl: webhookUrl,
      streamUrl: streamUrl,
      useStreaming: true // Activé pour utiliser le streaming
    };
    
    // Traiter le webhook
    const response = await WebhookHandler.handleTwilioWebhook(body, options);
    console.log("Réponse du webhook traitée:", response);
    
    // Si une réponse TwiML est fournie directement, l'utiliser
    const twiml = response.twiml || WebhookHandler.generateTwiMLResponse(
      response.agentResponse, 
      {
        gather: true,
        actionUrl: options.callbackUrl,
        language: "fr-FR",
        voice: "woman",
        timeout: 5,
        useStreaming: options.useStreaming,
        streamUrl: options.streamUrl
      }
    );
    
    console.log("TwiML généré:", twiml);
    
    // Renvoyer la réponse au format TwiML
    return new Response(twiml, {
      headers: {
        'Content-Type': 'text/xml'
      }
    });
  } catch (error) {
    console.error("Erreur dans l'API de webhook:", error);
    
    // Générer une réponse d'erreur TwiML
    const errorTwiml = WebhookHandler.generateTwiMLResponse(
      "Désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez rappeler ultérieurement.",
      { gather: false }
    );
    
    return new Response(errorTwiml, {
      headers: {
        'Content-Type': 'text/xml'
      },
      status: 500
    });
  }
}

export default handleTwilioWebhook;
