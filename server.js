// server.js
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TwilioStreamService } from './src/services/twilioStream/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port configuration
const PORT = process.env.PORT || 10000;

// Create HTTP server
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // API route for Twilio webhook
  if (pathname === '/api/twilio-webhook') {
    handleTwilioWebhook(req, res);
    return;
  }

  // API route for Twilio stream
  if (pathname === '/api/twilio-stream') {
    handleTwilioStream(req, res);
    return;
  }

  // Serve static files from the dist directory
  if (pathname === '/' || pathname === '/index.html') {
    serveFile(res, path.join(__dirname, 'dist', 'index.html'), 'text/html');
    return;
  }

  // Other static files
  const filePath = path.join(__dirname, 'dist', pathname);
  
  // Check if file exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = getContentType(ext);
    serveFile(res, filePath, contentType);
    return;
  }

  // 404 for files not found
  res.writeHead(404);
  res.end('Not Found');
});

// WebSocket server for Twilio Streaming
const wss = new WebSocketServer({ 
  noServer: true
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  try {
    const url = request.url || '';
    const pathname = new URL(`http://${request.headers.host}${url}`).pathname;
    
    console.log(`[WEBSOCKET] Requête d'upgrade pour: ${pathname}`);
    
    if (pathname === '/twilio-stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
        console.log('[WEBSOCKET] Nouvelle connexion établie sur /twilio-stream');
        
        // Handle WebSocket messages
        ws.on('message', async (message) => {
          try {
            // Convert message to string
            const messageString = message.toString();
            
            // Handle the message with TwilioStreamService
            await TwilioStreamService.handleWebSocketMessage(
              messageString, 
              // Function to send audio response
              async (audioBase64, streamSid) => {
                try {
                  if (ws.readyState === ws.OPEN) {
                    console.log(`[WEBSOCKET] Envoi de la réponse audio pour le stream ${streamSid}`);
                    const response = {
                      event: 'media',
                      streamSid: streamSid,
                      media: {
                        payload: audioBase64
                      }
                    };
                    ws.send(JSON.stringify(response));
                  } else {
                    console.error(`[WEBSOCKET] Impossible d'envoyer l'audio, connexion fermée`);
                  }
                } catch (error) {
                  console.error("[WEBSOCKET] Erreur d'envoi de réponse audio:", error);
                }
              }
            );
          } catch (error) {
            console.error("[WEBSOCKET] Erreur lors du traitement du message:", error);
          }
        });
        
        // Handle connection close
        ws.on('close', (code, reason) => {
          console.log(`[WEBSOCKET] Connexion fermée: code=${code}, raison=${reason || 'non spécifiée'}`);
        });
        
        // Handle errors
        ws.on('error', (error) => {
          console.error('[WEBSOCKET] Erreur WebSocket:', error);
        });
      });
    } else {
      socket.destroy();
    }
  } catch (error) {
    console.error("[WEBSOCKET] Erreur lors du traitement de la demande d'upgrade:", error);
    socket.destroy();
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/twilio-stream`);
});

// Utility functions
function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error');
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  });
}

function getContentType(ext) {
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };
  
  return contentTypes[ext] || 'text/plain';
}

// Handle Twilio webhook
async function handleTwilioWebhook(req, res) {
  try {
    console.log("Webhook Twilio reçu");
    
    // Get request body
    let body = {};
    if (req.method === 'POST') {
      // Handle form data
      let data = '';
      
      await new Promise((resolve, reject) => {
        req.on('data', chunk => {
          data += chunk.toString();
        });
        
        req.on('end', () => {
          try {
            // Try to parse as JSON
            try {
              body = JSON.parse(data);
            } catch (e) {
              // Try to parse as URL-encoded
              const params = new URLSearchParams(data);
              params.forEach((value, key) => {
                body[key] = value;
              });
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        
        req.on('error', reject);
      });
    }
    
    console.log("Corps du webhook:", body);
    
    // URL for WebSocket based on the current URL
    const origin = `http://${req.headers.host}`;
    const webhookUrl = `${origin}/api/twilio-webhook`;
    const streamUrl = `ws://${req.headers.host}/twilio-stream`;
    
    console.log("URLs configurées - Webhook:", webhookUrl);
    console.log("URLs configurées - Stream:", streamUrl);
    
    // Get options from environment
    const options = {
      openAIApiKey: process.env.OPENAI_API_KEY,
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL",
      openAIModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      callbackUrl: webhookUrl,
      streamUrl: streamUrl,
      useStreaming: true
    };
    
    // Process the webhook
    const { WebhookHandler } = await import('./src/services/webhookHandler.js');
    const response = await WebhookHandler.handleTwilioWebhook(body, options);
    
    // Generate TwiML response
    let twiml;
    if (response.twiml) {
      twiml = response.twiml;
    } else {
      twiml = WebhookHandler.generateTwiMLResponse(
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
    }
    
    // Send TwiML response
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml);
  } catch (error) {
    console.error("Erreur dans l'API de webhook:", error);
    
    // Generate error TwiML response
    const errorTwiml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say language="fr-FR" voice="woman">
          Désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez rappeler ultérieurement.
        </Say>
        <Hangup/>
      </Response>
    `;
    
    res.writeHead(500, { 'Content-Type': 'text/xml' });
    res.end(errorTwiml);
  }
}

// Handle Twilio stream initialization
async function handleTwilioStream(req, res) {
  console.log("[TWILIO-STREAM] Initialisation du stream API");
  
  try {
    const streamConfig = {
      openAIApiKey: process.env.OPENAI_API_KEY,
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL",
      openAIModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      systemPrompt: "Tu es un assistant téléphonique IA. Réponds de manière concise et utile. Parle en français."
    };
    
    // Determine WebSocket URL
    const host = req.headers.host || 'localhost:' + PORT;
    const wsProtocol = req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${host}/twilio-stream`;
    
    console.log(`[TWILIO-STREAM] WebSocket URL configurée: ${wsUrl}`);
    
    // Response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "success",
      message: "WebSocket server configuré et prêt à recevoir des connexions",
      wsUrl: wsUrl
    }));
  } catch (error) {
    console.error("[TWILIO-STREAM] Erreur:", error);
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "error",
      message: "Erreur lors de la configuration du WebSocket",
      error: error instanceof Error ? error.message : String(error)
    }));
  }
}
