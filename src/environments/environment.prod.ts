export const environment = {
  production: true,
  
  azure: {
    speechKey: process.env['AZURE_SPEECH_KEY'] || '',
    speechRegion: process.env['AZURE_SPEECH_REGION'] || 'westus2',
    
    avatar: {
      character: process.env['AZURE_AVATAR_CHARACTER'] || 'lisa',
      style: process.env['AZURE_AVATAR_STYLE'] || 'casual-sitting',
      voiceName: process.env['AZURE_VOICE_NAME'] || 'pt-BR-FranciscaNeural',
      
      custom: {
        enabled: process.env['AZURE_CUSTOM_AVATAR_ENABLED'] === 'true',
        avatarId: process.env['AZURE_CUSTOM_AVATAR_ID'] || '',
        style: process.env['AZURE_CUSTOM_AVATAR_STYLE'] || 'default',
        background: {
          color: process.env['AZURE_AVATAR_BG_COLOR'] || '#FFFFFFFF',
          image: process.env['AZURE_AVATAR_BG_IMAGE'] || null
        }
      }
    },
    
    speechRecognition: {
      language: process.env['AZURE_STT_LANGUAGE'] || 'pt-BR',
      continuousRecognition: true,
      enableAutomaticPunctuation: true
    }
  },
  
  chatbot: {
    apiUrl: process.env['CHATBOT_API_URL'] || '',
    headers: {
      'userIdentification': process.env['CHATBOT_USER_ID'] || '',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    timeout: parseInt(process.env['CHATBOT_TIMEOUT'] || '30000'),
    streaming: true,
    maxTokens: parseInt(process.env['CHATBOT_MAX_TOKENS'] || '4000'),
    
    fallbackMessages: {
      error: "Desculpe, não consegui processar sua solicitação. Pode tentar novamente?",
      timeout: "A resposta está demorando mais que o esperado. Pode reformular sua pergunta?",
      apiUnavailable: "O serviço está temporariamente indisponível. Tente novamente em alguns instantes."
    }
  },
  
  debug: {
    enableConsoleLog: process.env['ENABLE_DEBUG_LOG'] === 'true',
    enablePerformanceMonitoring: process.env['ENABLE_PERFORMANCE_MONITORING'] === 'true',
    keepAliveInterval: parseInt(process.env['KEEP_ALIVE_INTERVAL'] || '30000'),
    sessionTimeout: parseInt(process.env['SESSION_TIMEOUT'] || '300000')
  }
};