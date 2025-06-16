// src/environments/environment.ts
export const environment = {
  production: false,
  
  // Configurações do Azure Speech Service
  azure: {
    speechKey: 'b04ef0d065ed4f8fa3ae08ad5fe32c60', // ⚠️ IMPORTANTE: Substituir pela sua chave real
    speechRegion: 'westus2', // ⚠️ IMPORTANTE: Substituir pela sua região
    
    // Configurações do Avatar
    avatar: {
      // Avatar padrão
      character: 'lisa',
      style: 'casual-sitting',
      voiceName: 'pt-BR-FranciscaNeural',
      
      // Configurações para avatar personalizado
      // Seguindo a documentação: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-custom-text-to-speech-avatar
      custom: {
        enabled: false, // Habilitar para usar avatar personalizado
        avatarId: 'pontobb-avatar1', // ID do avatar personalizado criado no Azure
        style: '', // Estilo do avatar personalizado
        background: {
          color: '#FFFFFFFF', // Cor de fundo (formato ARGB)
          image: null // URL da imagem de fundo (opcional)
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
    apiUrl: 'https://acs-assist-avatar-bb.nia.servicos.bb.com.br/acs/llms/agent/opensearch', // ⚠️ IMPORTANTE: Substituir pela URL da sua API
    headers: {
      'userIdentification': '',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
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