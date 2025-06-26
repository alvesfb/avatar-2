// src/environments/environment.ts
export const environment = {
  production: false,
  
  // Configurações do Azure Speech Service
  azure: {
    speechKey: 'bd2b2c3cefc04f53a8a38716688b5832', // ⚠️ IMPORTANTE: Substituir pela sua chave real
    speechRegion: 'westus2', // ⚠️ IMPORTANTE: Substituir pela sua região
    
    // Configurações do Avatar
    avatar: {
      // Avatar padrão
      character: 'vivian',
      style: '',
      voiceName: 'pt-BR-FranciscaNeural',
      
      // Configurações para avatar personalizado
      // Seguindo a documentação: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-custom-text-to-speech-avatar
      custom: {
        enabled: true, // Habilitar para usar avatar personalizado
        avatarId: 'vivian', // ID do avatar personalizado criado no Azure
        style: '', // Estilo do avatar personalizado
        voiceName: 'VivianNeural',
        voiceEndpointId: 'a309caf0-97b4-4e8f-b8c6-89ce450294a1',
        background: {
          color: '#FFFFFFFF', // Cor de fundo (formato ARGB)
          image: null // URL da imagem de fundo (opcional)
        },
        // 🆕 ADICIONAR: Configurações de crop/enquadramento
        cropSettings: {
          topLeftX: 600,
          topLeftY: 50,
          bottomRightX: 1320,
          bottomRightY: 1080
        }
      }
    },
    
    // Configurações de Speech Recognition (STT)
    speechRecognition: {
      language: 'pt-BR',
      continuousRecognition: true,
      enableAutomaticPunctuation: true
    }
  },
  
  // Configurações da API do Chatbot
  chatbot: {
    apiUrl: 'https://generabb-acs.gbb.servicos.bb.com.br/acs/llms/agent', // ⚠️ IMPORTANTE: Substituir pela URL da sua API
    headers: {
      'Content-Type': "application/json",
      'agent_id': "ingpt",
      'userIdentification': "F3155027",
      'uor': "459593",
      'client_id': "eyJpZCI6IjkxZjIxNDItNmNmMy00NTk1LTkxNTMtODhjZiIsImNvZGlnb1B1YmxpY2Fkb3IiOjAsImNvZGlnb1NvZnR3YXJlIjo1OTkxNywic2VxdWVuY2lhbEluc3RhbGFjYW8iOjV9"
    },
    timeout: 30000, // 30 segundos
    
    // Configurações do streaming de resposta
    streaming: true,
    maxTokens: 4000,
    
    // Configurações de fallback para erros
    fallbackMessages: {
      error: "Desculpe, não consegui processar sua solicitação. Pode tentar novamente?",
      timeout: "A resposta está demorando mais que o esperado. Pode reformular sua pergunta?",
      apiUnavailable: "O serviço está temporariamente indisponível. Tente novamente em alguns instantes."
    }
  },
  
  // Configurações de debug e logs
  debug: {
    enableConsoleLog: true,
    enablePerformanceMonitoring: true,
    keepAliveInterval: 30000, // 30 segundos
    sessionTimeout: 300000 // 5 minutos
  }
};