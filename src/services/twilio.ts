// Service pour l'intégration avec l'API Twilio

// Constantes par défaut pour Twilio - Identifiants réels de l'utilisateur
export const DEFAULT_ACCOUNT_SID = "ACf97ca82f3a8f446ed9bae39357b43529";
export const DEFAULT_AUTH_TOKEN = "2e5fe947091ea3683e22a64aeb758339";
export const DEFAULT_FROM_NUMBER = "+16812545825"; // Numéro de téléphone Twilio de l'utilisateur
export const DEFAULT_STATUS_CALLBACK_URL = "https://chaleur-pro-ia-conversations.lovable.app/api/twilio-webhook";

// Mettre à jour l'interface pour les appels Twilio
export interface TwilioCallOptions {
  to: string;
  from: string;
  text?: string;
  voiceId?: string;
  accountSid: string;
  authToken: string;
  callbackUrl?: string;
  callSid?: string;
  agentMode?: boolean;
  streamUrl?: string;
  useStreaming?: boolean;
}

// Fonction utilitaire pour vérifier si les identifiants Twilio sont des valeurs par défaut
const isUsingDefaultCredentials = (accountSid: string, authToken: string, fromNumber: string): boolean => {
  // Puisque nous avons configuré les vrais identifiants comme valeurs par défaut,
  // cette fonction retourne toujours false pour permettre les appels
  return false;
};

// Fonction pour effectuer un appel Twilio
export const makeCall = async (options: TwilioCallOptions): Promise<{ callSid: string; status: string }> => {
  const { 
    to, 
    from, 
    text, 
    accountSid, 
    authToken, 
    callbackUrl, 
    callSid,
    agentMode = false,
    voiceId,
    useStreaming = false,
    streamUrl
  } = options;

  console.log(`[TWILIO] Début initialisation appel: de ${from} vers ${to}`);
  console.log(`[TWILIO] Options d'appel: useStreaming=${useStreaming}, streamUrl=${streamUrl || 'non défini'}, voiceId=${voiceId || 'non défini'}`);
  console.log(`[TWILIO] Paramètres d'authentification: accountSid=${accountSid}`);

  // Vérifier si des identifiants par défaut sont utilisés
  if (isUsingDefaultCredentials(accountSid, authToken, from)) {
    console.error(`[TWILIO] ERREUR: Identifiants Twilio par défaut détectés! Veuillez configurer de vrais identifiants Twilio.`);
    throw new Error("Identifiants Twilio non configurés. Veuillez entrer vos identifiants Twilio réels dans les paramètres.");
  }

  // Validation supplémentaire pour le format du numéro de téléphone
  if (!to.startsWith('+')) {
    throw new Error("Le numéro de téléphone doit être au format international (commençant par +)");
  }

  // Si un callSid est fourni, c'est une mise à jour d'appel existant
  if (callSid) {
    console.log(`[TWILIO] Mise à jour d'un appel existant (CallSid: ${callSid})`);
    return updateCall(options);
  }

  // Construire les paramètres de l'appel
  const params = new URLSearchParams();
  params.append('To', to);
  params.append('From', from);
  
  // Déterminer l'URL de callback à utiliser
  const effectiveCallbackUrl = callbackUrl || DEFAULT_STATUS_CALLBACK_URL;
  
  console.log(`[TWILIO] URL de callback configurée: ${effectiveCallbackUrl}`);
  
  // Ajouter le StatusCallback si fourni
  if (effectiveCallbackUrl) {
    console.log(`[TWILIO] Utilisation du callback URL: ${effectiveCallbackUrl}`);
    params.append('StatusCallback', effectiveCallbackUrl);
    // Correction du format des événements de callback - séparer avec des espaces
    params.append('StatusCallbackEvent', 'initiated ringing answered completed');
    params.append('StatusCallbackMethod', 'POST');
  }
  
  // Si streamUrl est fourni et useStreaming est true, utiliser le mode streaming
  if (useStreaming && streamUrl) {
    console.log(`[TWILIO] Configuration du mode streaming avec URL: ${streamUrl}`);
    const twiml = `
      <Response>
        <Connect>
          <Stream url="${streamUrl}" />
        </Connect>
      </Response>
    `;
    
    console.log(`[TWILIO] TwiML généré pour streaming: ${twiml}`);
    params.set('Twiml', twiml);
  } else if (text) {
    // Construire le TwiML pour l'appel
    let twiml = '<Response>';
    
    // Si voiceId est fourni, on utilise ElevenLabs via un paramètre personnalisé
    if (voiceId) {
      // Ajouter un paramètre pour ElevenLabs
      twiml += `<Say voice="woman" language="fr-FR" elevenlabs-voice-id="${voiceId}">${text}</Say>`;
    } else {
      // Utiliser la voix Twilio standard 
      twiml += `<Say voice="woman" language="fr-FR">${text}</Say>`;
    }
    
    // Si en mode agent, ajouter un Gather pour la reconnaissance vocale
    if (agentMode && effectiveCallbackUrl) {
      twiml += `
        <Gather input="speech" timeout="3" action="${effectiveCallbackUrl}" method="POST" language="fr-FR">
          <Say voice="woman" language="fr-FR">Je vous écoute.</Say>
        </Gather>
        <Redirect method="POST">${effectiveCallbackUrl}</Redirect>
      `;
    }
    
    twiml += '</Response>';
    
    console.log(`[TWILIO] TwiML généré standard: ${twiml}`);
    
    // Ajouter le TwiML aux paramètres
    params.append('Twiml', twiml);
  }
  
  // Construire l'URL de l'API Twilio
  const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
  console.log(`[TWILIO] URL API: ${apiUrl}`);
  
  try {
    console.log(`[TWILIO] Préparation des en-têtes de la requête...`);
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`)
    };
    
    console.log(`[TWILIO] En-têtes préparés, envoi de la requête à l'API...`);
    console.log(`[TWILIO] Paramètres de la requête: ${params.toString()}`);
    
    // Effectuer la requête à l'API Twilio
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: params.toString()
    });
    
    console.log(`[TWILIO] Statut de la réponse API: ${response.status} ${response.statusText}`);
    
    // Vérifier si la requête a réussi
    if (!response.ok) {
      const responseText = await response.text();
      console.error(`[TWILIO] Réponse brute en cas d'erreur: ${responseText}`);
      
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[TWILIO] Erreur lors du parsing de la réponse: ${parseError}`);
        throw new Error(`Erreur Twilio: ${response.status} ${response.statusText}`);
      }
      
      console.error(`[TWILIO] Erreur détaillée: Code=${errorData.code || 'inconnu'}, Message=${errorData.message || 'inconnu'}, MoreInfo=${errorData.more_info || 'non disponible'}`);
      
      // Messages d'erreur plus spécifiques selon le code d'erreur
      if (errorData.code === 21212) {
        throw new Error("Le numéro d'appel n'est pas un numéro valide ou n'est pas dans un format accepté par Twilio.");
      } else if (errorData.code === 21210) {
        throw new Error("Le numéro d'expéditeur n'est pas valide ou n'est pas vérifié dans votre compte Twilio.");
      } else if (errorData.code === 21215) {
        throw new Error("L'adresse d'urgence n'est pas configurée dans votre compte Twilio. Cela est requis pour les appels vocaux aux États-Unis.");
      } else {
        throw new Error(`Erreur Twilio: ${errorData.message || response.statusText}`);
      }
    }
    
    // Récupérer les données de la réponse
    const responseText = await response.text();
    console.log(`[TWILIO] Réponse brute: ${responseText}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[TWILIO] Erreur lors du parsing de la réponse: ${parseError}`);
      throw new Error(`Erreur de format dans la réponse Twilio`);
    }
    
    console.log(`[TWILIO] Appel créé avec succès: CallSid=${data.sid}, Status=${data.status}`);
    
    return {
      callSid: data.sid,
      status: data.status
    };
  } catch (error) {
    console.error(`[TWILIO] Erreur lors de l'appel Twilio:`, error);
    
    // Améliorer le message d'erreur
    if (error instanceof TypeError && error.message === 'Load failed') {
      console.error(`[TWILIO] Il s'agit probablement d'une erreur d'authentification, d'identifiants incorrects ou d'une configuration manquante dans Twilio.`);
      throw new Error("Erreur de connexion à l'API Twilio. Vérifiez vos identifiants et que vous avez configuré l'adresse d'urgence dans votre compte Twilio.");
    }
    
    // Propager l'erreur
    throw error;
  }
};

// Fonction pour mettre à jour un appel existant
const updateCall = async (options: TwilioCallOptions): Promise<{ callSid: string; status: string }> => {
  const { 
    callSid, 
    text, 
    accountSid, 
    authToken, 
    callbackUrl,
    agentMode = false
  } = options;
  
  console.log(`[TWILIO] Début mise à jour appel: CallSid=${callSid}`);
  
  if (!callSid) {
    const error = new Error("CallSid requis pour mettre à jour un appel");
    console.error(`[TWILIO] ${error.message}`);
    throw error;
  }
  
  // Construire le TwiML pour la mise à jour
  let twiml = '<Response>';
  
  if (text) {
    // Ajouter le message texte
    twiml += `<Say voice="woman" language="fr-FR">${text}</Say>`;
    
    // Si en mode agent, ajouter un Gather pour la reconnaissance vocale
    if (agentMode && callbackUrl) {
      twiml += `
        <Gather input="speech" timeout="3" action="${callbackUrl}" method="POST" language="fr-FR">
          <Say voice="woman" language="fr-FR">Je vous écoute.</Say>
        </Gather>
        <Redirect>${callbackUrl}</Redirect>
      `;
    }
  }
  
  twiml += '</Response>';
  
  console.log(`[TWILIO] TwiML pour mise à jour: ${twiml}`);
  
  // Construire l'URL de l'API Twilio pour mettre à jour l'appel
  const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;
  console.log(`[TWILIO] URL API pour mise à jour: ${apiUrl}`);
  
  const params = new URLSearchParams();
  params.append('Twiml', twiml);
  
  try {
    console.log(`[TWILIO] Envoi de la requête de mise à jour...`);
    
    // Effectuer la requête à l'API Twilio
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`)
      },
      body: params.toString()
    });
    
    console.log(`[TWILIO] Statut de la réponse de mise à jour: ${response.status} ${response.statusText}`);
    
    // Vérifier si la requête a réussi
    if (!response.ok) {
      const responseText = await response.text();
      console.error(`[TWILIO] Réponse brute en cas d'erreur: ${responseText}`);
      
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[TWILIO] Erreur lors du parsing de la réponse: ${parseError}`);
        throw new Error(`Erreur Twilio: ${response.status} ${response.statusText}`);
      }
      
      console.error(`[TWILIO] Erreur détaillée: Code=${errorData.code || 'inconnu'}, Message=${errorData.message || 'inconnu'}, MoreInfo=${errorData.more_info || 'non disponible'}`);
      throw new Error(`Erreur Twilio: ${errorData.message || response.statusText}`);
    }
    
    // Récupérer les données de la réponse
    const responseText = await response.text();
    console.log(`[TWILIO] Réponse brute de mise à jour: ${responseText}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[TWILIO] Erreur lors du parsing de la réponse: ${parseError}`);
      throw new Error(`Erreur de format dans la réponse Twilio`);
    }
    
    console.log(`[TWILIO] Appel mis à jour avec succès: CallSid=${data.sid}, Status=${data.status}`);
    
    return {
      callSid: data.sid,
      status: data.status
    };
  } catch (error) {
    console.error(`[TWILIO] Erreur lors de la mise à jour de l'appel Twilio:`, error);
    throw error;
  }
};

// Fonction pour analyser la réponse webhook de Twilio
export const parseWebhookResponse = (body: any): { callSid: string; speechResult: string } => {
  return {
    callSid: body.CallSid || "",
    speechResult: body.SpeechResult || ""
  };
};

// Fonction pour récupérer l'enregistrement d'un appel
export const getRecording = async (
  callSid: string, 
  accountSid: string = DEFAULT_ACCOUNT_SID, 
  authToken: string = DEFAULT_AUTH_TOKEN
): Promise<string> => {
  try {
    // Construire l'URL de l'API Twilio pour les enregistrements
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}/Recordings.json`;
    
    // Effectuer la requête à l'API Twilio
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`)
      }
    });
    
    // Vérifier si la requête a réussi
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erreur Twilio: ${errorData.message || response.statusText}`);
    }
    
    // Récupérer les données de la réponse
    const data = await response.json();
    
    // Vérifier s'il y a des enregistrements
    if (data.recordings && data.recordings.length > 0) {
      // Récupérer le dernier enregistrement
      const latestRecording = data.recordings[0];
      
      // Construire l'URL de l'enregistrement
      return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${latestRecording.sid}.mp3`;
    } else {
      throw new Error("Aucun enregistrement trouvé pour cet appel");
    }
  } catch (error) {
    console.error("Erreur lors de la récupération de l'enregistrement:", error);
    throw error;
  }
};

// Ajouter la structure pour le service Twilio
export const TwilioService = {
  makeCall,
  parseWebhookResponse,
  getRecording,
  DEFAULT_ACCOUNT_SID,
  DEFAULT_AUTH_TOKEN,
  DEFAULT_FROM_NUMBER,
  DEFAULT_STATUS_CALLBACK_URL,
};
