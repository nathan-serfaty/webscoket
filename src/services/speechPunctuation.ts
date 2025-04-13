// Service pour optimiser la ponctuation et la pronunciation des textes pour la synthèse vocale

export const SpeechPunctuationService = {
    // Optimiser la ponctuation pour une meilleure lecture par les TTS
    optimizePunctuation: (text: string): string => {
      if (!text) return text;
      
      let processedText = text;
      
      // Ajouter des espaces autour des signes de ponctuation si nécessaire
      processedText = processedText
        .replace(/([.,!?;:])(\w)/g, '$1 $2')  // Espace après ponctuation
        .replace(/\s+/g, ' ')  // Normaliser les espaces multiples
        .trim();
      
      // Ajouter un point final si nécessaire
      if (!/[.!?]$/.test(processedText)) {
        processedText += '.';
      }
      
      return processedText;
    },
    
    // Optimiser un texte pour les appels téléphoniques
    optimizeForPhoneCall: (text: string): string => {
      if (!text) return text;
      
      let processedText = text;
      
      // Remplacer les acronymes communs pour les énoncer lettre par lettre
      const acronyms = [
        'PAC', 'EDF', 'GDF', 'TTC', 'HT', 'TVA', 'SNCF', 'RATP', 'TGV', 'PDF', 
        'COVID', 'RIB', 'IBAN', 'BIC', 'SMS', 'PIN', 'SIM', 'RDV'
      ];
      
      acronyms.forEach(acronym => {
        const regex = new RegExp(`\\b${acronym}\\b`, 'g');
        processedText = processedText.replace(regex, acronym.split('').join(' '));
      });
      
      // Traiter les numéros de téléphone pour les énoncer chiffre par chiffre avec des pauses
      processedText = processedText.replace(
        /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/g, 
        '$1 $2 $3 $4 $5'
      );
      
      // Optimiser les nombres pour une meilleure prononciation
      processedText = processedText.replace(/(\d+),(\d+)/g, '$1 virgule $2');
      
      // Ajouter des pauses et ralentir légèrement les passages importants
      processedText = processedText
        .replace(/Attention/gi, 'Attention,')
        .replace(/Important/gi, 'Important,')
        .replace(/Merci de noter/gi, 'Merci de noter que,')
        .replace(/Veuillez/gi, 'Veuillez,');
      
      // Optimiser la ponctuation standard
      return SpeechPunctuationService.optimizePunctuation(processedText);
    },
    
    // Formater une somme d'argent pour une meilleure prononciation
    formatMoney: (amount: number, currency: string = 'EUR'): string => {
      const wholePart = Math.floor(amount);
      const decimalPart = Math.round((amount - wholePart) * 100);
      
      let result = '';
      
      if (wholePart === 0 && decimalPart > 0) {
        result = `${decimalPart} centimes`;
      } else if (decimalPart === 0) {
        result = `${wholePart} ${wholePart === 1 ? 'euro' : 'euros'}`;
      } else {
        result = `${wholePart} ${wholePart === 1 ? 'euro' : 'euros'} et ${decimalPart} ${decimalPart === 1 ? 'centime' : 'centimes'}`;
      }
      
      if (currency !== 'EUR') {
        // Pour d'autres devises, adapter le format
        if (currency === 'USD') {
          result = result.replace('euro', 'dollar').replace('euros', 'dollars');
        } else if (currency === 'GBP') {
          result = result.replace('euro', 'livre').replace('euros', 'livres');
        }
      }
      
      return result;
    },
    
    // Formater une date pour une meilleure prononciation
    formatDate: (date: Date): string => {
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      
      const monthNames = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
      ];
      
      return `le ${day} ${monthNames[month - 1]} ${year}`;
    },
    
    // Formater un numéro de téléphone pour une meilleure prononciation
    formatPhoneNumber: (phoneNumber: string): string => {
      // Nettoyer le numéro (enlever les espaces, tirets, etc.)
      const cleaned = phoneNumber.replace(/\D/g, '');
      
      // Format français standard (groupes de 2 chiffres)
      if (cleaned.length === 10) {
        return cleaned.match(/.{1,2}/g)?.join(' ') || phoneNumber;
      }
      
      // Si le format n'est pas standard, retourner avec des espaces entre chaque chiffre
      return cleaned.split('').join(' ');
    },
  
    // Préparer un script pour les appels téléphoniques
    preparePhoneScript: (text: string): string => {
      if (!text) return '';
      
      let processedText = text;
      
      // Remplacer les formulations écrites par des formulations orales
      const replacements: Record<string, string> = {
        'Veuillez noter': 'Notez bien',
        'N\'hésitez pas à': 'Vous pouvez',
        'Je vous invite à': 'Je vous propose de',
        'Cordialement': 'Je vous remercie de votre attention',
        'Bien à vous': 'Merci pour votre écoute',
        'Sincères salutations': 'Je vous souhaite une excellente journée',
        'Merci de votre compréhension': 'Je vous remercie de votre compréhension',
        'Pour toute question': 'Si vous avez des questions',
        'En cas de besoin': 'Si vous avez besoin d\'aide',
        'Nous sommes à votre disposition': 'Nous sommes là pour vous aider',
        'N\'hésitez pas à nous contacter': 'Vous pouvez nous joindre',
        'Rappel:': 'Je vous rappelle que',
        'NB:': 'Notez bien que',
        'PS:': 'J\'ajoute que',
        'cf.': 'voir'
      };
      
      // Appliquer les remplacements
      Object.entries(replacements).forEach(([pattern, replacement]) => {
        const regex = new RegExp(pattern, 'g');
        processedText = processedText.replace(regex, replacement);
      });
      
      // Ajouter des pauses stratégiques pour le rythme
      processedText = processedText
        .replace(/\. /g, '. <pause> ')
        .replace(/! /g, '! <pause> ')
        .replace(/\? /g, '? <pause> ')
        .replace(/: /g, ': <pause> ');
      
      // Remplacer les parenthèses par des pauses
      processedText = processedText
        .replace(/\(/g, '<pause> ')
        .replace(/\)/g, ' <pause>');
      
      // Optimiser pour les appels téléphoniques
      return SpeechPunctuationService.optimizeForPhoneCall(processedText);
    }
  };
  
  // Alias pour la compatibilité avec d'autres imports
  export const optimizePunctuation = SpeechPunctuationService.optimizePunctuation;
  export const optimizeForPhoneCall = SpeechPunctuationService.optimizeForPhoneCall;
  export const formatMoney = SpeechPunctuationService.formatMoney;
  export const formatDate = SpeechPunctuationService.formatDate;
  export const formatPhoneNumber = SpeechPunctuationService.formatPhoneNumber;
  export const preparePhoneScript = SpeechPunctuationService.preparePhoneScript;
  