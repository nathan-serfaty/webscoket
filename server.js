const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Import TwilioStreamService depuis les fichiers compilés
const { TwilioStreamService } = require('./dist/services/twilioStreamService');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8080;

// Configurer CORS pour les requêtes HTTP
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'dist')));

// Parser pour les différents formats de requêtes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint pour le webhook Twilio
app.post('/api/twilio-webhook', async (req, res) => {
  try {
    console.log("Webhook Twilio reçu", req.url);
    console.log("Corps du webhook:", req.body);
    
    // Configurer les URLs
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    const origin = `${protocol}://${host}`;
    const webhookUrl = `${origin}/api/twilio-webhook`;
    const streamUrl = `${protocol === 'https' ? 'wss' : 'ws'}://${host}/twilio-stream`;
    
    console.log("URLs configurées - Webhook:", webhookUrl);
    console.log("URLs configurées - Stream:", streamUrl);
    
    // Options de configuration
    const options = {
      openAIApiKey: process.env.OPENAI_API_KEY || "your-openai-api-key",
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "your-elevenlabs-api-key",
      voiceId: process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL",
      openAIModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      callbackUrl: webhookUrl,
      streamUrl: streamUrl,
      useStreaming: true
    };
    
    // Générer la réponse TwiML pour le streaming
    const twiml = TwilioStreamService.generateStreamTwiML(
      streamUrl,
      "Bonjour, je suis votre assistant IA. Comment puis-je vous aider aujourd'hui?"
    );
    
    // Renvoyer la réponse au format TwiML
    res.set('Content-Type', 'text/xml');
    res.send(twiml);
    
  } catch (error) {
    console.error("Erreur dans l'API de webhook:", error);
    
    // Générer une réponse d'erreur TwiML
    const errorTwiml = `
      <Response>
        <Say voice="woman" language="fr-FR">Désolé, une erreur s'est produite. Veuillez rappeler ultérieurement.</Say>
      </Response>
    `;
    
    res.status(500).set('Content-Type', 'text/xml').send(errorTwiml);
  }
});

// Configurer le serveur WebSocket
const wss = new WebSocket.Server({ noServer: true });

// Gérer les mises à niveau de connexion
server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;
    
    console.log(`[WEBSOCKET] Demande d'upgrade reçue pour: ${pathname}`);
    
    if (pathname === '/twilio-stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  } catch (error) {
    console.error("[WEBSOCKET] Erreur de traitement de l'upgrade:", error);
    socket.destroy();
  }
});

// Gérer les connexions WebSocket
wss.on('connection', (ws, request) => {
  console.log('[WEBSOCKET] Nouvelle connexion établie');
  
  // Gérer les messages
  ws.on('message', async (message) => {
    try {
      console.log(`[WEBSOCKET] Message reçu`);
      
      // Traiter les messages avec TwilioStreamService
      await TwilioStreamService.handleWebSocketMessage(
        message.toString(),
        async (audioBase64, streamSid) => {
          if (ws.readyState === ws.OPEN) {
            const response = {
              event: 'media',
              streamSid: streamSid,
              media: {
                payload: audioBase64
              }
            };
            ws.send(JSON.stringify(response));
          }
        }
      );
    } catch (error) {
      console.error("[WEBSOCKET] Erreur de traitement de message:", error);
    }
  });
  
  // Gérer la fermeture
  ws.on('close', () => {
    console.log('[WEBSOCKET] Connexion fermée');
  });
  
  // Gérer les erreurs
  ws.on('error', (error) => {
    console.error('[WEBSOCKET] Erreur WebSocket:', error);
  });
});

// Démarrer le serveur
server.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
  console.log(`Endpoint WebSocket: ws://localhost:${port}/twilio-stream`);
  console.log(`Endpoint HTTP: http://localhost:${port}/api/twilio-webhook`);
});
