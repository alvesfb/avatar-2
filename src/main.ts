// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { importProvidersFrom } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from './environments/environment';

// Configuração global da aplicação
if (environment.production) {
  // Desabilita logs em produção
  console.log = console.warn = console.info = () => {};
} else {
  // Log de inicialização em desenvolvimento
  console.log('🚀 Iniciando Avatar Miniatura - LIA');
  console.log('🔧 Ambiente:', environment.production ? 'Produção' : 'Desenvolvimento');
  console.log('🌐 Região Azure:', environment.azure.speechRegion);
  console.log('🎭 Avatar:', environment.azure.avatar.character);
  console.log('🗣️ Voz:', environment.azure.avatar.voiceName);
  
  if (environment.azure.avatar.custom.enabled) {
    console.log('👤 Avatar personalizado habilitado:', environment.azure.avatar.custom.avatarId);
  }
}

// Verificações de compatibilidade
function checkBrowserCompatibility(): boolean {
  const checks = {
    webrtc: typeof RTCPeerConnection !== 'undefined',
    getusermedia: navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
    webspeech: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
    https: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
    canvas: !!document.createElement('canvas').getContext,
    webaudio: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined'
  };

  const incompatible = Object.entries(checks)
    .filter(([_, supported]) => !supported)
    .map(([feature]) => feature);

  if (incompatible.length > 0) {
    // Filtrar webspeech do aviso se for a única incompatibilidade
    const criticalIncompatible = incompatible.filter(feature => feature !== 'webspeech');
    
    if (criticalIncompatible.length > 0) {
      console.warn('⚠️ Recursos críticos não suportados:', criticalIncompatible);
    }
    
    if (incompatible.includes('webspeech')) {
      console.info('ℹ️ Web Speech API nativa não disponível (usaremos Azure Speech Service)');
    }
    
    if (!checks.https) {
      console.error('❌ HTTPS é obrigatório para WebRTC e microfone');
    }
    
    if (!checks.webrtc) {
      console.error('❌ WebRTC não é suportado neste navegador');
    }
    
    // Retorna false apenas se houver incompatibilidades críticas
    return criticalIncompatible.length === 0;
  }

  console.log('✅ Todos os recursos necessários são suportados');
  return true;
}

// Inicialização da aplicação
async function initializeApp() {
  try {
    // Verificar compatibilidade do navegador
    const isCompatible = checkBrowserCompatibility();
    
    if (!isCompatible && environment.production) {
      // Em produção, ainda tenta inicializar mesmo com incompatibilidades
      console.warn('⚠️ Iniciando com funcionalidades limitadas');
    }

    // Verificar se as configurações obrigatórias estão presentes
    if (!environment.azure.speechKey || environment.azure.speechKey === 'YOUR_AZURE_SPEECH_KEY') {
      console.error('❌ Azure Speech Key não configurada');
      if (environment.production) {
        throw new Error('Configuração do Azure Speech Service não encontrada');
      }
    }

    if (!environment.chatbot.apiUrl || environment.chatbot.apiUrl === 'https://your-api-endpoint.com/chat') {
      console.error('❌ URL da API do chatbot não configurada');
      if (environment.production) {
        throw new Error('Configuração da API do chatbot não encontrada');
      }
    }

    // Bootstrap da aplicação Angular
    const app = await bootstrapApplication(AppComponent, {
      providers: [
        importProvidersFrom(FormsModule),
        // Adicionar outros providers conforme necessário
      ]
    });

    console.log('✅ Aplicação inicializada com sucesso');
    return app;

  } catch (error) {
    console.error('❌ Erro ao inicializar aplicação:', error);
    
    // Mostrar mensagem de erro amigável ao usuário
    showErrorMessage(error);
    throw error;
  }
}

// Função para mostrar mensagens de erro
function showErrorMessage(error: any) {
  const errorContainer = document.createElement('div');
  errorContainer.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(220, 53, 69, 0.95);
      color: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
      text-align: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <h3 style="margin: 0 0 12px 0; font-size: 18px;">❌ Erro de Inicialização</h3>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.4;">
        ${error.message || 'Não foi possível inicializar o assistente virtual.'}
      </p>
      <button onclick="window.location.reload()" style="
        background: white;
        color: #dc3545;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
      ">
        Tentar Novamente
      </button>
    </div>
  `;
  
  document.body.appendChild(errorContainer);
}

// Aguarda o DOM estar pronto antes de inicializar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Manipulação de erros globais não capturados
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Promise rejeitada não tratada:', event.reason);
  
  if (!environment.production) {
    // Em desenvolvimento, mostra o erro
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  console.error('❌ Erro JavaScript global:', event.error);
  
  if (!environment.production) {
    // Em desenvolvimento, permite que o erro seja mostrado
    return true;
  }
  
  return false;
});

// Exportar função de inicialização para uso em testes
export { initializeApp };