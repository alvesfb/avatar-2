// src/app/components/avatar/avatar.component.ts
import { Component, ElementRef, OnInit, OnDestroy, AfterViewInit, ViewChild, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { ChatbotService } from '../../services/chatbot.service';
import { SpeechService, SpeechRecognitionResult } from '../../services/speech.service';

declare var SpeechSDK: any;

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Avatar minimizado no canto inferior direito -->
    <div class="avatar-container" [class.minimized]="isMinimized" [class.expanded]="!isMinimized">
      
      <!-- Botão do avatar minimizado -->
      <div class="avatar-minimized" *ngIf="isMinimized" (click)="maximizeAndConnect()">
        <div class="avatar-icon">
          <span class="avatar-emoji">🤖</span>
          <div class="pulse-ring" [class.active]="isConnected && isSpeaking"></div>
          <div class="connection-indicator" [class.connected]="isConnected"></div>
        </div>
      </div>

      <!-- Interface expandida -->
      <div class="avatar-interface" *ngIf="!isMinimized">
        <!-- Cabeçalho com controles -->
        <div class="avatar-header">
          <div class="avatar-title">
            <span class="avatar-emoji">🤖</span>
            <span>Fale com a LIA</span>
          </div>
          <button class="minimize-btn" (click)="minimizeAvatar()" aria-label="Minimizar">
            <span>✕</span>
          </button>
        </div>

        <!-- Container do vídeo do avatar -->
        <div class="avatar-video-container">
          <canvas #avatarCanvas class="avatar-canvas"></canvas>
          <video #avatarVideo style="display: none;" autoplay playsinline></video>
          <audio #avatarAudio autoplay></audio>
          
          <!-- Indicadores de status -->
          <div class="status-overlay">
            <div class="connection-status" [class.connected]="isConnected">
              <span class="status-dot"></span>
              <span class="status-text">{{ getConnectionStatus() }}</span>
            </div>
            
            <!-- Indicador de fala do avatar -->
            <div class="speaking-indicator" *ngIf="isSpeaking">
              <div class="sound-waves">
                <div class="wave"></div>
                <div class="wave"></div>
                <div class="wave"></div>
              </div>
              <span>Falando...</span>
            </div>
          </div>

          <!-- Spinner de loading -->
          <div class="loading-overlay" *ngIf="isLoading">
            <div class="spinner"></div>
            <span>{{ loadingMessage }}</span>
          </div>
        </div>

        <!-- Interface de chat -->
        <div class="chat-interface">
          <!-- Histórico de mensagens (simplificado) -->
          <div class="chat-history" #chatHistory>
            <div *ngFor="let message of chatMessages" 
                 class="message" 
                 [class.user]="message.role === 'user'"
                 [class.assistant]="message.role === 'assistant'">
              <div class="message-content">{{ message.content }}</div>
              <div class="message-time">{{ message.timestamp | date:'HH:mm' }}</div>
            </div>
          </div>

          <!-- Entrada de texto e controles -->
          <div class="input-container">
            <!-- Botão do microfone -->
            <button 
              class="mic-button" 
              [class.active]="isListening"
              [class.disabled]="!isConnected"
              (click)="toggleMicrophone()"
              [disabled]="!isConnected"
              title="{{ isListening ? 'Parar gravação' : 'Iniciar gravação' }}">
              <span class="mic-icon">{{ isListening ? '🔴' : '🎤' }}</span>
            </button>

            <!-- Campo de texto -->
            <input 
              #textInput
              type="text" 
              [(ngModel)]="inputText" 
              (keyup.enter)="sendMessage()"
              placeholder="{{ isListening ? 'Escutando...' : 'Digite ou use o microfone...' }}"
              [disabled]="!isConnected || isListening"
              class="text-input">

            <!-- Botão de enviar -->
            <button 
              class="send-button" 
              (click)="sendMessage()" 
              [disabled]="!isConnected || isSpeaking || (!inputText.trim() && !isListening)"
              title="Enviar mensagem">
              <span class="send-icon">→</span>
            </button>
          </div>

          <!-- Indicador de reconhecimento de voz -->
          <div class="voice-feedback" *ngIf="isListening || voiceText">
            <div class="voice-animation">
              <div class="voice-bars">
                <div class="bar" *ngFor="let i of [1,2,3,4,5]"></div>
              </div>
            </div>
            <span class="voice-text">{{ voiceText || 'Escutando...' }}</span>
          </div>

          <!-- Mensagem de erro -->
          <div class="error-message" *ngIf="errorMessage">
            {{ errorMessage }}
            <button class="error-close" (click)="clearError()">✕</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .avatar-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Estados do container */
    .avatar-container.minimized { width: 70px; height: 70px; }
    .avatar-container.expanded {
      width: 380px;
      height: 520px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.2);
      overflow: hidden;
    }

    /* Avatar minimizado */
    .avatar-minimized {
      width: 70px;
      height: 70px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    .avatar-minimized:hover { transform: scale(1.1); box-shadow: 0 12px 40px rgba(102, 126, 234, 0.4); }

    .avatar-icon { position: relative; display: flex; align-items: center; justify-content: center; }
    .avatar-emoji { font-size: 32px; z-index: 2; }

    .pulse-ring {
      position: absolute;
      width: 80px;
      height: 80px;
      border: 3px solid #ffffff;
      border-radius: 50%;
      opacity: 0;
      z-index: 1;
    }
    .pulse-ring.active { animation: pulse 2s infinite; }

    @keyframes pulse {
      0% { transform: scale(0.8); opacity: 1; }
      100% { transform: scale(1.4); opacity: 0; }
    }

    .connection-indicator {
      position: absolute;
      top: 5px;
      right: 5px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ff4444;
      border: 2px solid white;
      z-index: 3;
    }
    .connection-indicator.connected { background: #44ff44; }

    /* Interface expandida */
    .avatar-interface { height: 100%; display: flex; flex-direction: column; }

    .avatar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .avatar-title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 16px; }

    .minimize-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: white;
      transition: all 0.2s ease;
    }
    .minimize-btn:hover { background: rgba(255, 255, 255, 0.3); transform: scale(1.1); }

    /* Container do vídeo */
    .avatar-video-container {
      position: relative;
      height: 240px;
      background: #ffffff; /* MUDANÇA: fundo branco em vez do gradiente */
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    /* Canvas do avatar - APENAS ajustar object-fit */
    .avatar-canvas { 
      width: 100%; 
      height: 100%; 
      object-fit: contain; /* MUDANÇA: contain em vez de cover para manter proporções */
    }

    .status-overlay {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.7);
      border-radius: 20px;
      color: white;
      font-size: 12px;
    }

    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #ff4444; }
    .connection-status.connected .status-dot { background: #44ff44; }

    .speaking-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: rgba(102, 126, 234, 0.9);
      border-radius: 20px;
      color: white;
      font-size: 12px;
    }

    .sound-waves { display: flex; gap: 2px; align-items: center; }
    .wave {
      width: 3px;
      height: 12px;
      background: white;
      border-radius: 2px;
      animation: wave 1s infinite;
    }
    .wave:nth-child(2) { animation-delay: 0.1s; }
    .wave:nth-child(3) { animation-delay: 0.2s; }

    @keyframes wave {
      0%, 100% { height: 4px; }
      50% { height: 12px; }
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      color: #667eea;
      font-size: 14px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e8eaf0;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    /* Chat interface */
    .chat-interface { flex: 1; display: flex; flex-direction: column; padding: 16px; gap: 12px; }

    .chat-history {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 150px;
      padding-right: 4px;
    }

    .chat-history::-webkit-scrollbar { width: 4px; }
    .chat-history::-webkit-scrollbar-track { background: #f0f2f5; border-radius: 2px; }
    .chat-history::-webkit-scrollbar-thumb { background: #c4c4c4; border-radius: 2px; }

    .message { display: flex; flex-direction: column; max-width: 85%; }
    .message.user { align-self: flex-end; }
    .message.assistant { align-self: flex-start; }

    .message-content {
      padding: 8px 12px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .message.user .message-content {
      background: #667eea;
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message.assistant .message-content {
      background: #f0f2f5;
      color: #333;
      border-bottom-left-radius: 4px;
    }

    .message-time {
      font-size: 11px;
      color: #888;
      margin-top: 4px;
      padding: 0 4px;
    }
    .message.user .message-time { text-align: right; }

    /* Controles */
    .input-container {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 16px;
      border: 1px solid #e9ecef;
    }

    .mic-button, .send-button {
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      color: white;
      font-size: 16px;
    }

    .mic-button {
      background: #6c757d;
      font-size: 16px;
    }
    .mic-button:hover:not(:disabled) { transform: scale(1.1); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
    .mic-button.active {
      background: #dc3545;
      animation: pulse-mic 2s infinite;
    }
    .mic-button.disabled, .mic-button:disabled {
      background: #adb5bd;
      cursor: not-allowed;
      transform: none;
    }

    @keyframes pulse-mic {
      0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
      100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
    }

    .text-input {
      flex: 1;
      border: none;
      background: transparent;
      padding: 12px 8px;
      font-size: 14px;
      outline: none;
      color: #333;
    }
    .text-input::placeholder { color: #6c757d; }
    .text-input:disabled { color: #adb5bd; }

    .send-button {
      background: #667eea;
      font-size: 18px;
      font-weight: bold;
    }
    .send-button:hover:not(:disabled) { background: #5a67d8; transform: scale(1.1); }
    .send-button:disabled {
      background: #adb5bd;
      cursor: not-allowed;
      transform: none;
    }

    /* Feedback de voz */
    .voice-feedback {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: rgba(102, 126, 234, 0.1);
      border-radius: 12px;
      border: 1px solid rgba(102, 126, 234, 0.2);
      font-size: 13px;
      color: #667eea;
    }

    .voice-bars { display: flex; gap: 2px; align-items: center; }
    .voice-bars .bar {
      width: 3px;
      height: 16px;
      background: #667eea;
      border-radius: 2px;
      animation: voice-bar 1.5s infinite;
    }
    .voice-bars .bar:nth-child(2) { animation-delay: 0.1s; }
    .voice-bars .bar:nth-child(3) { animation-delay: 0.2s; }
    .voice-bars .bar:nth-child(4) { animation-delay: 0.3s; }
    .voice-bars .bar:nth-child(5) { animation-delay: 0.4s; }

    @keyframes voice-bar {
      0%, 100% { height: 6px; opacity: 0.3; }
      50% { height: 16px; opacity: 1; }
    }

    /* Erro */
    .error-message {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #fee;
      color: #c53030;
      border-radius: 8px;
      border-left: 3px solid #c53030;
      font-size: 12px;
    }

    .error-close {
      background: none;
      border: none;
      color: #c53030;
      cursor: pointer;
      font-size: 14px;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .error-close:hover { background: rgba(197, 48, 48, 0.1); border-radius: 50%; }

    /* Responsividade */
    @media (max-width: 768px) {
      .avatar-container.expanded { width: 320px; height: 480px; bottom: 10px; right: 10px; }
      .avatar-video-container { height: 200px; }
    }

    @media (max-height: 600px) {
      .avatar-container.expanded { height: 90vh; max-height: 450px; }
      .avatar-video-container { height: 160px; }
      .chat-history { max-height: 100px; }
    }
  `]
})
export class AvatarComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('avatarVideo', { static: false }) avatarVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('avatarAudio', { static: false }) avatarAudio!: ElementRef<HTMLAudioElement>;
  @ViewChild('avatarCanvas', { static: false }) avatarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('textInput', { static: false }) textInput!: ElementRef<HTMLInputElement>;
  @ViewChild('chatHistory', { static: false }) chatHistory!: ElementRef<HTMLDivElement>;

  @Output() statusChange = new EventEmitter<string>();
  @Output() error = new EventEmitter<string>();

  // Estado do componente
  isMinimized: boolean = true; // Iniciar minimizado
  isConnected: boolean = false;
  isSpeaking: boolean = false;
  isLoading: boolean = false;
  isListening: boolean = false;
  inputText: string = '';
  voiceText: string = '';
  errorMessage: string = '';
  loadingMessage: string = 'Conectando...';

  // Mensagens do chat
  chatMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }> = [];

  // Objetos do Azure Speech SDK
  private speechConfig: any;
  private avatarConfig: any;
  private avatarSynthesizer: any;
  private peerConnection: RTCPeerConnection | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;

  private speechQueue: string[] = []; // Fila de textos para falar
  private isCurrentlySpeaking = false; // Flag para controle síncrono
  private currentSpeechPromise: Promise<void> | null = null;

  // Flags de controle
  private viewInitialized = false;
  private sessionActive = false;

  constructor(
    private chatbotService: ChatbotService,
    private speechService: SpeechService
  ) {}

  ngOnInit() {
    this.loadSpeechSDK();
    
    // Listener para evento de teste manual
    window.addEventListener('forceAvatarConnection', () => {
      console.log('🔧 Forçando conexão via evento de teste...');
      this.maximizeAndConnect();
    });
  }

  ngAfterViewInit() {
    this.viewInitialized = true;
    console.log('👀 Avatar component view initialized');
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private loadSpeechSDK() {
    if (typeof SpeechSDK === 'undefined') {
      console.log('⏳ Carregando Azure Speech SDK...');
      const script = document.createElement('script');
      script.src = 'https://aka.ms/csspeech/jsbrowserpackageraw';
      script.onload = () => {
        console.log('✅ Azure Speech SDK carregado');
        
        // Log da versão do SDK se disponível
        try {
          if (SpeechSDK && SpeechSDK.SpeechConfig) {
            console.log('🔍 SpeechSDK disponível com SpeechConfig');
            console.log('🔍 SpeechSDK.AvatarSynthesizer disponível:', typeof SpeechSDK.AvatarSynthesizer);
            console.log('🔍 SpeechSDK.AvatarConfig disponível:', typeof SpeechSDK.AvatarConfig);
          }
        } catch (e) {
          console.log('ℹ️ Não foi possível verificar versão do SDK');
        }
        
        setTimeout(() => {
          this.initializeAvatarConfig();
        }, 100);
      };
      script.onerror = () => {
        this.setError('Erro ao carregar Azure Speech SDK');
      };
      document.head.appendChild(script);
    } else {
      console.log('✅ Azure Speech SDK já estava carregado');
      
      // Verificar disponibilidade dos componentes
      console.log('🔍 Verificando componentes do SDK...');
      console.log('🔍 SpeechConfig:', typeof SpeechSDK.SpeechConfig);
      console.log('🔍 AvatarSynthesizer:', typeof SpeechSDK.AvatarSynthesizer);
      console.log('🔍 AvatarConfig:', typeof SpeechSDK.AvatarConfig);
      
      this.initializeAvatarConfig();
    }
  }

private async initializeAvatarConfig() {
  try {
    console.log('🔧 Inicializando configuração do avatar...');
    
    // Verificações das credenciais (manter igual)
    if (!environment.azure.speechKey || environment.azure.speechKey === 'YOUR_AZURE_SPEECH_KEY') {
      throw new Error('❌ ERRO: Azure Speech Key não configurada!');
    }

    if (!environment.azure.speechRegion) {
      throw new Error('❌ ERRO: Azure Speech Region não configurada!');
    }

    const isValidKey = await this.validateAzureCredentials();
    if (!isValidKey) {
      throw new Error('❌ ERRO: Credenciais Azure inválidas!');
    }

    console.log('🔑 Speech Key validada:', environment.azure.speechKey.substring(0, 8) + '...');
    
    // Configuração do Speech Service
    this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      environment.azure.speechKey,
      environment.azure.speechRegion
    );
    
    this.speechConfig.speechSynthesisVoiceName = environment.azure.avatar.voiceName;
    
    // CONFIGURAÇÃO CORRIGIDA DO VIDEO FORMAT E CROP
    console.log('🎥 Configurando video format e crop para enquadramento adequado...');
    const videoFormat = new SpeechSDK.AvatarVideoFormat();
    
    // ✅ AJUSTE DO CROP PARA CENTRALIZAR O AVATAR COMO NA IMAGEM
    // Valores ajustados para mostrar o avatar centralizado com fundo branco
    let videoCropTopLeftX = 400;      // Reduzido para mostrar mais da lateral
    let videoCropTopLeftY = 0;        // Começar do topo
    let videoCropBottomRightX = 1520; // Expandido para mostrar mais do avatar
    let videoCropBottomRightY = 1080; // Altura completa
    
    // Aplicar o crop otimizado
    videoFormat.setCropRange(
      new SpeechSDK.Coordinate(videoCropTopLeftX, videoCropTopLeftY), 
      new SpeechSDK.Coordinate(videoCropBottomRightX, videoCropBottomRightY)
    );

    console.log('📐 Crop configurado:', {
      topLeft: { x: videoCropTopLeftX, y: videoCropTopLeftY },
      bottomRight: { x: videoCropBottomRightX, y: videoCropBottomRightY }
    });

    // Configuração do avatar COM o videoFormat corrigido
    this.avatarConfig = new SpeechSDK.AvatarConfig(
      environment.azure.avatar.character,
      environment.azure.avatar.style,
      videoFormat  // Aplicar o crop corrigido
    );
    
    // ✅ CONFIGURAR FUNDO BRANCO NO SDK
    this.avatarConfig.backgroundColor = '#FFFFFFFF'; // Branco sólido (ARGB)
    
    // Avatar customizado se habilitado
    if (environment.azure.avatar.custom.enabled) {
      this.avatarConfig.customized = true;
      console.log('👤 Avatar customizado habilitado');
    }

    console.log('✅ Configuração do avatar inicializada com crop otimizado e fundo branco');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar configuração do avatar:', error);
    this.setError(`Erro na configuração: ${error}`);
    throw error;
  }
}

private async validateAzureCredentials(): Promise<boolean> {
  try {
    console.log('🔍 Validando credenciais Azure...');
    
    // Criar configuração de teste
    const testConfig = SpeechSDK.SpeechConfig.fromSubscription(
      environment.azure.speechKey,
      environment.azure.speechRegion
    );
    
    // Tentar uma operação simples para validar
    const testSynthesizer = new SpeechSDK.SpeechSynthesizer(testConfig);
    
    return new Promise((resolve) => {
      // Usar um timeout para não travar
      const timeout = setTimeout(() => {
        console.warn('⏰ Timeout na validação de credenciais');
        testSynthesizer.close();
        resolve(false);
      }, 5000);
      
      try {
        // Tentar sintetizar um texto simples para testar
        testSynthesizer.speakTextAsync(
          "teste",
          () => {
            clearTimeout(timeout);
            testSynthesizer.close();
            console.log('✅ Credenciais Azure validadas com sucesso');
            resolve(true);
          },
          (error: any) => {
            clearTimeout(timeout);
            testSynthesizer.close();
            console.error('❌ Erro na validação de credenciais:', error);
            resolve(false);
          }
        );
      } catch (error) {
        clearTimeout(timeout);
        testSynthesizer.close();
        console.error('❌ Erro ao criar teste de validação:', error);
        resolve(false);
      }
    });
  } catch (error) {
    console.error('❌ Erro na validação de credenciais:', error);
    return false;
  }
}

  async maximizeAndConnect() {
    console.log('🔄 Maximizando avatar e conectando...');
    this.isMinimized = false;
    
    // Aguarda um pouco para a animação e então conecta automaticamente
    setTimeout(() => {
      if (!this.isConnected && !this.isLoading) {
        console.log('🚀 Iniciando conexão automática...');
        this.connectAvatar();
      } else {
        console.log('ℹ️ Avatar já está conectado ou conectando');
      }
    }, 500); // Aumentei para 500ms para dar mais tempo para a animação
  }

  minimizeAvatar() {
    this.isMinimized = true;
    // Não desconectar - manter conexão ativa
  }

private async connectAvatar() {
  console.log('🔌 Tentando conectar avatar...');
  
  if (this.isConnected || this.isLoading) {
    console.log('ℹ️ Avatar já está conectado ou carregando');
    return;
  }

  if (!this.viewInitialized || !this.avatarCanvas) {
    console.warn('⚠️ Avatar canvas não está pronto, tentando novamente em 1s...');
    setTimeout(() => {
      this.connectAvatar();
    }, 1000);
    return;
  }

  this.isLoading = true;
  this.loadingMessage = 'Conectando avatar...';
  this.clearError();

  try {
    console.log('🎨 Configurando canvas...');
    const canvas = this.avatarCanvas.nativeElement;
    this.canvasContext = canvas.getContext('2d');
    canvas.width = 380;
    canvas.height = 240;

    // CORREÇÃO CRÍTICA: Obter credenciais ICE do Azure primeiro
    console.log('🔑 Obtendo credenciais ICE do Azure...');
    const iceCredentials = await this.getAzureIceCredentials();
    
    if (!iceCredentials) {
      throw new Error('Falha ao obter credenciais ICE do Azure');
    }

    console.log('🌐 Criando WebRTC connection com servidores ICE do Azure...');
    
    // USAR AS CREDENCIAIS ICE DO AZURE (como no exemplo que funciona)
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{
        urls: [iceCredentials.iceServerUrl],
        username: iceCredentials.iceServerUsername,
        credential: iceCredentials.iceServerCredential
      }]
    });

    // Eventos críticos do WebRTC
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🔗 ICE state:', this.peerConnection?.iceConnectionState);
      
      if (this.peerConnection?.iceConnectionState === 'failed') {
        console.error('❌ Conexão ICE falhou');
        this.setError('Falha na conexão ICE');
      } else if (this.peerConnection?.iceConnectionState === 'connected') {
        console.log('✅ Conexão ICE estabelecida');
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('📹 Recebendo track:', event.track.kind);
      if (event.track.kind === 'video' && this.avatarVideo && event.streams[0]) {
        this.avatarVideo.nativeElement.srcObject = event.streams[0];
        this.avatarVideo.nativeElement.onloadedmetadata = () => {
          console.log('📺 Vídeo metadata carregado');
          this.startVideoProcessing();
        };
      }
    };

    // IMPORTANTE: Adicionar transceivers como no exemplo
    console.log('📡 Adicionando transceivers...');
    this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    console.log('🤖 Criando avatar synthesizer...');
    
    this.avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(
      this.speechConfig, 
      this.avatarConfig
    );

    // Eventos do avatar
    this.avatarSynthesizer.avatarEventReceived = (s: any, e: any) => {
      let offsetMessage = ", offset from session start: " + e.offset / 10000 + "ms.";
      if (e.offset === 0) {
        offsetMessage = "";
      }
      console.log("Event received: " + e.description + offsetMessage);
    };

    this.avatarSynthesizer.synthesizing = (sender: any, event: any) => {
      this.isSpeaking = true;
    };
    
    this.avatarSynthesizer.synthesisCompleted = (sender: any, event: any) => {
      this.isSpeaking = false;
    };

    this.avatarSynthesizer.synthesisStarted = (sender: any, event: any) => {
      console.log('🗣️ Avatar synthesis started');
      this.isSpeaking = true;
    };

    this.avatarSynthesizer.synthesisCanceled = (sender: any, event: any) => {
      console.log('🔇 Avatar synthesis canceled:', event.reason);
      this.isSpeaking = false;
    };

    console.log('🔗 Iniciando conexão do avatar...');
    
    // Usar o método CORRETO de conexão (como no exemplo)
    const connected = await this.startAvatarConnectionWithPromise();
    
    if (connected) {
      this.isConnected = true;
      this.isLoading = false;
      this.sessionActive = true;
      this.statusChange.emit('connected');
      console.log('🎉 Avatar conectado com sucesso!');
    } else {
      throw new Error('Falha na conexão do avatar');
    }

  } catch (error) {
    console.error('❌ Erro na conexão do avatar:', error);
    this.cleanup();
    this.setError(`Erro de conexão: ${error}`);
    this.isLoading = false;
  }
}

// NOVO MÉTODO: Obter credenciais ICE do Azure (CRÍTICO)
private async getAzureIceCredentials(): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // URL correta para obter token ICE do Azure
    const tokenUrl = `https://${environment.azure.speechRegion}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`;
    
    console.log('🔗 Fazendo requisição para:', tokenUrl);
    
    xhr.open("GET", tokenUrl);
    xhr.setRequestHeader("Ocp-Apim-Subscription-Key", environment.azure.speechKey);
    
    xhr.addEventListener("readystatechange", function() {
      if (this.readyState === 4) {
        if (this.status === 200) {
          try {
            const responseData = JSON.parse(this.responseText);
            console.log('✅ Credenciais ICE obtidas com sucesso');
            
            resolve({
              iceServerUrl: responseData.Urls[0],
              iceServerUsername: responseData.Username,
              iceServerCredential: responseData.Password
            });
          } catch (error) {
            console.error('❌ Erro ao parsear resposta ICE:', error);
            reject(error);
          }
        } else {
          console.error('❌ Erro HTTP ao obter credenciais ICE:', this.status, this.statusText);
          console.error('❌ Resposta:', this.responseText);
          reject(new Error(`HTTP ${this.status}: ${this.statusText}`));
        }
      }
    });
    
    xhr.addEventListener("error", function() {
      console.error('❌ Erro de rede ao obter credenciais ICE');
      reject(new Error('Erro de rede'));
    });
    
    xhr.addEventListener("timeout", function() {
      console.error('❌ Timeout ao obter credenciais ICE');
      reject(new Error('Timeout'));
    });
    
    xhr.timeout = 10000; // 10 segundos de timeout
    xhr.send();
  });
}

// MÉTODO CORRIGIDO: startAvatarAsync usando Promise como no exemplo
private startAvatarConnectionWithPromise(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('📡 Chamando startAvatarAsync com Promise...');
    
    // Timeout de 30 segundos (o exemplo não tinha timeout no startAvatarAsync)
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout de 30 segundos atingido');
      resolve(false);
    }, 30000);

    // USAR O MÉTODO CORRETO: startAvatarAsync retorna Promise
    this.avatarSynthesizer.startAvatarAsync(this.peerConnection)
      .then((result: any) => {
        clearTimeout(timeoutId);
        
        // Verificar o resultado como no exemplo
        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          console.log("✅ Avatar started. Result ID: " + result.resultId);
          resolve(true);
        } else {
          console.log("❌ Unable to start avatar. Result ID: " + result.resultId);
          
          if (result.reason === SpeechSDK.ResultReason.Canceled) {
            let cancellationDetails = SpeechSDK.CancellationDetails.fromResult(result);
            if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
              console.log("❌ Cancellation details:", cancellationDetails.errorDetails);
            }
            console.log("❌ Unable to start avatar: " + cancellationDetails.errorDetails);
          }
          
          resolve(false);
        }
      })
      .catch((error: any) => {
        clearTimeout(timeoutId);
        console.error('❌ startAvatarAsync PROMISE ERROR:', error);
        resolve(false);
      });
      
    console.log('📞 startAvatarAsync Promise foi chamado, aguardando resposta...');
  });
}

// MÉTODO ALTERNATIVO: Se a Promise não funcionar, usar callbacks como no seu código atual
private startAvatarConnectionWithCallbacks(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('📡 Chamando startAvatarAsync com callbacks...');
    
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout de 20 segundos atingido (callbacks)');
      resolve(false);
    }, 20000);

    try {
      this.avatarSynthesizer.startAvatarAsync(
        this.peerConnection,
        (result: any) => {
          clearTimeout(timeoutId);
          console.log('✅ startAvatarAsync SUCCESS (callbacks)');
          console.log('📊 Connection result:', result);
          
          // Verificar se o resultado indica sucesso
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            resolve(true);
          } else {
            console.log('❌ Avatar não iniciou corretamente:', result.reason);
            resolve(false);
          }
        },
        (error: any) => {
          clearTimeout(timeoutId);
          console.error('❌ startAvatarAsync ERROR (callbacks):', error);
          resolve(false);
        }
      );
      
      console.log('📞 startAvatarAsync callbacks foram configurados, aguardando resposta...');
      
    } catch (syncError) {
      clearTimeout(timeoutId);
      console.error('❌ Erro síncrono ao chamar startAvatarAsync (callbacks):', syncError);
      resolve(false);
    }
  });
}

  // Método alternativo baseado no código original que funciona
  private async tryAlternativeConnection(): Promise<boolean> {
    console.log('🔄 Tentando método alternativo de conexão...');
    
    try {
      // Recriar objetos do zero - às vezes resolve problemas de estado
      console.log('🔄 Recriando speech config...');
      const newSpeechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        environment.azure.speechKey,
        environment.azure.speechRegion
      );
      newSpeechConfig.speechSynthesisVoiceName = environment.azure.avatar.voiceName;

      console.log('🔄 Recriando avatar config...');
      const newAvatarConfig = new SpeechSDK.AvatarConfig(
        environment.azure.avatar.character,
        environment.azure.avatar.style
      );

      console.log('🔄 Recriando peer connection...');
      if (this.peerConnection) {
        this.peerConnection.close();
      }

      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      this.peerConnection.ontrack = (event) => {
        console.log('📹 Track recebido (método alternativo):', event.track.kind);
        if (event.track.kind === 'video' && this.avatarVideo && event.streams[0]) {
          this.avatarVideo.nativeElement.srcObject = event.streams[0];
          this.avatarVideo.nativeElement.onloadedmetadata = () => {
            console.log('📺 Vídeo metadata carregado (alternativo)');
            this.startVideoProcessing();
          };
        }
      };

      console.log('🔄 Recriando avatar synthesizer...');
      if (this.avatarSynthesizer) {
        try {
          this.avatarSynthesizer.close();
        } catch (e) {
          console.log('ℹ️ Erro ao fechar synthesizer anterior (ignorando)');
        }
      }

      this.avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(newSpeechConfig, newAvatarConfig);

      // Configurar eventos novamente
      this.avatarSynthesizer.synthesizing = () => this.isSpeaking = true;
      this.avatarSynthesizer.synthesisCompleted = () => this.isSpeaking = false;
      this.avatarSynthesizer.synthesisStarted = () => {
        console.log('🗣️ Avatar synthesis started (alternativo)');
        this.isSpeaking = true;
      };

      console.log('🔄 Tentando startAvatarAsync com objetos recreados...');
      
      return new Promise((resolve) => {
        const altTimeoutId = setTimeout(() => {
          console.log('⏰ Método alternativo também deu timeout');
          resolve(false);
        }, 10000); // 10 segundos para o método alternativo

        this.avatarSynthesizer.startAvatarAsync(
          this.peerConnection,
          (result: any) => {
            clearTimeout(altTimeoutId);
            console.log('✅ Método alternativo FUNCIONOU!');
            console.log('📊 Alternative result:', result);
            resolve(true);
          },
          (error: any) => {
            clearTimeout(altTimeoutId);
            console.error('❌ Método alternativo também falhou:', error);
            resolve(false);
          }
        );
      });

    } catch (error) {
      console.error('❌ Erro no método alternativo:', error);
      return false;
    }
  }

  // Simplificar processamento de vídeo
  private startVideoProcessing() {
    if (!this.canvasContext || !this.avatarVideo) return;

    const processFrame = () => {
      if (!this.isConnected || !this.avatarVideo?.nativeElement || !this.canvasContext) {
        return;
      }

      const video = this.avatarVideo.nativeElement;
      const canvas = this.avatarCanvas.nativeElement;

      if (video.readyState >= 2) {
        this.canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      if (this.isConnected) {
        requestAnimationFrame(processFrame);
      }
    };

    processFrame();
  }

async sendMessage() {
  const message = this.inputText.trim();
  if (!message || !this.isConnected) return;

  // ✅ INTERROMPER fala atual quando usuário envia nova mensagem
  this.interruptForNewMessage();

  this.addMessage('user', message);
  this.inputText = '';

  try {
    const response = await this.chatbotService.sendMessage(message);
    
    if (typeof response === 'string') {
      // Resposta simples
      this.addMessage('assistant', response);
      // Falar resposta (interromperá qualquer fala anterior automaticamente)
      await this.speakText(response);
    } else {
      // Resposta streaming
      let fullResponse = '';
      const reader = response.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          fullResponse += value;
        }
        
        if (fullResponse.trim()) {
          this.addMessage('assistant', fullResponse);
          // Falar resposta completa (interromperá qualquer fala anterior)
          await this.speakText(fullResponse);
        }
      } finally {
        reader.releaseLock();
      }
    }
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    const errorMsg = 'Desculpe, ocorreu um erro. Pode tentar novamente?';
    this.addMessage('assistant', errorMsg);
    // Falar erro (interromperá qualquer fala anterior)
    await this.speakText(errorMsg);
  }
}

// ADICIONAR método para obter status da fala:
  public getSpeechStatus(): { isCurrentlySpeaking: boolean } {
    return {
      isCurrentlySpeaking: this.isCurrentlySpeaking
    };
  }

  private addMessage(role: 'user' | 'assistant', content: string) {
    this.chatMessages.push({
      role,
      content,
      timestamp: new Date()
    });

    // Scroll automático para a última mensagem
    setTimeout(() => {
      if (this.chatHistory) {
        const element = this.chatHistory.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

private async speakText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!this.avatarSynthesizer || !this.isConnected) {
      console.warn('⚠️ Avatar não conectado ou synthesizer não disponível');
      resolve();
      return;
    }

    // ✅ NOVA LÓGICA: Interromper fala atual se estiver falando
    if (this.isCurrentlySpeaking) {
      console.log('🔇 Interrompendo fala atual para nova mensagem');
      this.stopCurrentSpeech();
    }

    // ✅ LIMPAR FILA - não acumular mensagens
    this.speechQueue = [];

    this.speakTextNow(text)
      .then(() => resolve())
      .catch(error => reject(error));
  });
}

// ADICIONAR método para parar apenas a fala atual (sem limpar fila):
private stopCurrentSpeech(): void {
  if (!this.isCurrentlySpeaking || !this.avatarSynthesizer) return;

  console.log('🔇 Parando fala atual...');
  
  try {
    // Parar synthesizer imediatamente
    this.avatarSynthesizer.stopSpeakingAsync()
      .then(() => {
        console.log('✅ Fala atual interrompida');
      })
      .catch((error: any) => {
        console.error('❌ Erro ao parar fala:', error);
      })
      .finally(() => {
        // Garantir que o estado seja resetado
        this.isCurrentlySpeaking = false;
        this.isSpeaking = false;
      });
  } catch (error) {
    console.error('❌ Erro ao interromper fala:', error);
    this.isCurrentlySpeaking = false;
    this.isSpeaking = false;
  }
}

// ADICIONAR método para falar imediatamente:
private async speakTextNow(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!this.avatarSynthesizer || !this.isConnected) {
      reject(new Error('Avatar não conectado'));
      return;
    }

    console.log('🗣️ Iniciando nova fala:', text.substring(0, 50) + '...');
    
    // Marcar como falando
    this.isCurrentlySpeaking = true;
    this.isSpeaking = true;

    // Limpar e preparar texto
    const cleanText = text.replace(/[<>]/g, '').trim();
    if (!cleanText) {
      this.finishCurrentSpeech();
      resolve();
      return;
    }

    // Criar SSML otimizado
    const ssml = this.createOptimizedSSML(cleanText);

    // Configurar timeout para evitar travamento
    const speechTimeout = setTimeout(() => {
      console.warn('⏰ Timeout na fala, finalizando...');
      this.finishCurrentSpeech();
      reject(new Error('Timeout na síntese de fala'));
    }, 30000);

    // Executar síntese
    this.avatarSynthesizer.speakSsmlAsync(
      ssml,
      (result: any) => {
        clearTimeout(speechTimeout);
        
        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          console.log('✅ Fala concluída com sucesso');
          this.finishCurrentSpeech();
          resolve();
        } else {
          console.error('❌ Falha na síntese:', result.reason);
          this.finishCurrentSpeech();
          reject(new Error(`Falha na síntese: ${result.reason}`));
        }
      },
      (error: any) => {
        clearTimeout(speechTimeout);
        console.error('❌ Erro na fala do avatar:', error);
        this.finishCurrentSpeech();
        reject(new Error(`Erro na síntese: ${error}`));
      }
    );
  });
}

// ADICIONAR método para finalizar fala e processar fila:
private finishCurrentSpeech(): void {
  this.isCurrentlySpeaking = false;
  this.isSpeaking = false;
  
  console.log('✅ Fala atual finalizada');
  
  // ✅ REMOVIDO: Não processar fila automaticamente
  // O sistema agora só fala uma mensagem por vez, interrompendo a anterior
}

// ADICIONAR método para criar SSML otimizado:
private createOptimizedSSML(text: string): string {
  const voiceName = environment.azure.avatar.voiceName;
  
  // Escapar caracteres especiais
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // SSML otimizado para avatar
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="pt-BR">
    <voice name="${voiceName}">
      <mstts:leadingsilence-exact value="0"/>
      <prosody rate="0.9" pitch="+2%">
        ${escapedText}
      </prosody>
    </voice>
  </speak>`;
}

// ADICIONAR método para parar fala:
public stopSpeaking(): void {
  console.log('🔇 Comando para parar toda fala...');
  
  // Limpar fila (mesmo que não use mais)
  this.speechQueue = [];
  
  // Parar fala atual
  this.stopCurrentSpeech();
}

// ADICIONAR método específico para interrupção por nova mensagem:
private interruptForNewMessage(): void {
  if (this.isCurrentlySpeaking) {
    console.log('🔄 Interrompendo fala para nova mensagem do usuário');
    this.stopCurrentSpeech();
  }
}

  async toggleMicrophone() {
    if (this.isListening) {
      await this.stopListening();
    } else {
      await this.startListening();
    }
  }

  private async startListening() {
    if (this.isListening) return;

    try {
      const success = await this.speechService.startContinuousRecognition({
        onResult: (result: SpeechRecognitionResult) => {
          if (result.isFinal && result.text.trim()) {
            this.voiceText = '';
            this.inputText = result.text;
            this.stopListening();
            
            // ✅ INTERROMPER fala antes de processar nova mensagem por voz
            this.interruptForNewMessage();
            
            // Enviar automaticamente a mensagem reconhecida
            setTimeout(() => {
              this.sendMessage();
            }, 500);
          } else {
            this.voiceText = result.text;
          }
        },
        onError: (error: string) => {
          console.error('❌ Erro no reconhecimento de voz:', error);
          this.setError('Erro no reconhecimento de voz');
          this.stopListening();
        },
        onStart: () => {
          this.isListening = true;
          console.log('🎤 Reconhecimento de voz iniciado');
          
          // ✅ INTERROMPER fala quando começar a escutar
          this.interruptForNewMessage();
        },
        onStop: () => {
          this.isListening = false;
          this.voiceText = '';
          console.log('🔇 Reconhecimento de voz parado');
        }
      });

      if (!success) {
        this.setError('Não foi possível iniciar o reconhecimento de voz');
      }
    } catch (error) {
      console.error('❌ Erro ao iniciar reconhecimento:', error);
      this.setError('Erro ao acessar o microfone');
    }
  }

  private async stopListening() {
    if (!this.isListening) return;
    
    try {
      await this.speechService.stopContinuousRecognition();
    } catch (error) {
      console.error('❌ Erro ao parar reconhecimento:', error);
    }
  }

  getConnectionStatus(): string {
    if (this.isLoading) return 'Conectando...';
    return this.isConnected ? 'Conectado' : 'Desconectado';
  }

  private setError(message: string) {
    this.errorMessage = message;
    this.error.emit(message);
    
    // Auto-limpar erro após 10 segundos
    setTimeout(() => {
      if (this.errorMessage === message) {
        this.clearError();
      }
    }, 10000);
  }

  clearError() {
    this.errorMessage = '';
  }

  private cleanup(): void {
    console.log('🧹 Limpando recursos do avatar...');
    
    // Parar fala atual
    this.stopSpeaking();
    
    // Parar reconhecimento de voz
    if (typeof this.stopListening === 'function') {
      this.stopListening();
    }

    // Fechar avatar synthesizer
    if (this.avatarSynthesizer) {
      try {
        this.avatarSynthesizer.close();
      } catch (e) {
        console.warn('⚠️ Erro ao fechar synthesizer:', e);
      }
      this.avatarSynthesizer = null;
    }

    // Fechar peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        console.warn('⚠️ Erro ao fechar peer connection:', e);
      }
      this.peerConnection = null;
    }

    // Resetar estados
    this.isConnected = false;
    this.sessionActive = false;
    this.isSpeaking = false;
    this.isListening = false;
    this.isLoading = false;
    this.isCurrentlySpeaking = false;
    this.speechQueue = []; // Manter por compatibilidade, mas não é mais usado
    
    console.log('✅ Limpeza concluída');
  }
}