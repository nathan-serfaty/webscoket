import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { WebSocketServer } from 'ws';
import type { ViteDevServer } from 'vite';

// Import du service Twilio Stream
import { TwilioStreamService } from './src/services/twilioStreamService';

// Plugin WebSocket pour Vite
const websocketPlugin = () => {
  return {
    name: 'websocket-server',
    configureServer(server: ViteDevServer) {
      console.log("[WEBSOCKET] Configuration du serveur WebSocket - DÉMARRAGE");
      
      server.httpServer?.once('listening', () => {
        if (server.httpServer) {
          const address = server.httpServer.address();
          const addressInfo = typeof address === 'string' 
            ? address 
            : `${address?.address || '0.0.0.0'}:${address?.port || 8080}`;
            
          console.log(`[WEBSOCKET] Serveur HTTP en écoute sur ${addressInfo}`);
          
          // Create WebSocket server with noServer option
          const wss = new WebSocketServer({ 
            noServer: true,
          });
          
          console.log('[WEBSOCKET] Serveur WebSocket initialisé avec succès');
          console.log('[WEBSOCKET] En attente de connexions sur /twilio-stream');
          
          // Use httpServer.on('upgrade') to handle WebSocket upgrade requests
          server.httpServer.on('upgrade', (request, socket, head) => {
            try {
              const url = request.url || '';
              const host = request.headers.host || 'unknown';
              const fullUrl = `http://${host}${url}`;
              const pathname = new URL(fullUrl).pathname;
              
              console.log(`[WEBSOCKET] Demande d'upgrade reçue:`);
              console.log(`  - Chemin: ${pathname}`);
              console.log(`  - URL complète: ${fullUrl}`);
              console.log(`  - En-têtes:`, request.headers);
              
              if (pathname === '/twilio-stream') {
                console.log(`[WEBSOCKET] Traitement de la connexion WebSocket pour /twilio-stream`);
                wss.handleUpgrade(request, socket, head, (ws) => {
                  wss.emit('connection', ws, request);
                  console.log('[WEBSOCKET] Nouvelle connexion WebSocket établie sur /twilio-stream');
                  
                  // Traiter les messages WebSocket (audio de Twilio)
                  ws.on('message', async (message) => {
                    try {
                      // Convertir le message en string pour le traitement
                      const messageString = message.toString();
                      const messagePreview = messageString.length > 100 
                        ? `${messageString.substring(0, 100)}... (${messageString.length} caractères)` 
                        : messageString;
                      console.log(`[WEBSOCKET] Message reçu: ${messagePreview}`);
                      
                      const messageObj = JSON.parse(messageString);
                      console.log(`[WEBSOCKET] Type d'événement: ${messageObj.event || 'inconnu'}`);
                      console.log(`[WEBSOCKET] Stream SID: ${messageObj.streamSid || 'non défini'}`);
                      
                      // Traiter les messages avec le service TwilioStream
                      await TwilioStreamService.handleWebSocketMessage(
                        messageString, 
                        // Fonction pour envoyer une réponse audio
                        async (audioBase64, streamSid) => {
                          try {
                            if (ws.readyState === ws.OPEN) {
                              console.log(`[WEBSOCKET] Envoi de la réponse audio pour le stream ${streamSid} (${audioBase64.length} caractères)`);
                              const response = {
                                event: 'media',
                                streamSid: streamSid,
                                media: {
                                  payload: audioBase64
                                }
                              };
                              ws.send(JSON.stringify(response));
                              console.log(`[WEBSOCKET] Réponse audio envoyée avec succès`);
                            } else {
                              console.error(`[WEBSOCKET] Impossible d'envoyer l'audio, connexion fermée (état: ${ws.readyState})`);
                            }
                          } catch (error) {
                            console.error("[WEBSOCKET] Erreur d'envoi de réponse audio:", error);
                          }
                        }
                      );
                    } catch (error) {
                      console.error("[WEBSOCKET] Erreur lors du traitement du message:", error);
                      console.error(error);
                    }
                  });
                  
                  // Gérer la fermeture de connexion
                  ws.on('close', (code, reason) => {
                    console.log(`[WEBSOCKET] Connexion WebSocket fermée: code=${code}, raison=${reason?.toString() || 'non spécifiée'}`);
                  });
                  
                  // Gérer les erreurs
                  ws.on('error', (error) => {
                    console.error('[WEBSOCKET] Erreur WebSocket:', error);
                  });
                });
              } else {
                console.log(`[WEBSOCKET] Chemin non géré: ${pathname}`);
              }
            } catch (error) {
              console.error("[WEBSOCKET] Erreur lors du traitement de la demande d'upgrade:", error);
              socket.destroy();
            }
          });

          // Log WebSocket server info
          console.log(`[WEBSOCKET] WebSocket Server est prêt et en écoute sur ${addressInfo}`);
          console.log(`[WEBSOCKET] Endpoint: ws://${addressInfo}/twilio-stream`);
        } else {
          console.error('[WEBSOCKET] Impossible de démarrer le serveur WebSocket: server.httpServer est null');
        }
      });
    }
  };
};

// Configuration Vite
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080
  },
  plugins: [
    react(),
    websocketPlugin()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
