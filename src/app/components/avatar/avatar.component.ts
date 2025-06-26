// src/app/components/avatar/avatar.component.ts
import { Component, ElementRef, OnInit, OnDestroy, AfterViewInit, ViewChild, Output, EventEmitter, ChangeDetectorRef} from '@angular/core';
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
    <!-- Container principal do avatar -->
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
          
          <!-- Histórico de mensagens -->
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
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    /* Canvas do avatar */
    .avatar-canvas { 
      width: 100%; 
      height: 100%; 
      object-fit: contain;
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
  
  // Referências aos elementos DOM
  @ViewChild('avatarVideo', { static: false }) avatarVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('avatarAudio', { static: false }) avatarAudio!: ElementRef<HTMLAudioElement>;
  @ViewChild('avatarCanvas', { static: false }) avatarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('textInput', { static: false }) textInput!: ElementRef<HTMLInputElement>;
  @ViewChild('chatHistory', { static: false }) chatHistory!: ElementRef<HTMLDivElement>;

  @Output() statusChange = new EventEmitter<string>();
  @Output() error = new EventEmitter<string>();

  // Estado do componente
  isMinimized: boolean = true;
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
  
  // Controle de fala
  private speechQueue: string[] = [];
  private isCurrentlySpeaking = false;
  private currentSpeechPromise: Promise<void> | null = null;

  // Controle de microfone e detecção de silêncio
  private silenceTimer: any = null;
  private silenceThreshold = 3000; // 3 segundos de silêncio
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private isDetectingSilence = false;
  private lastAudioActivity = 0;

  // Flags de controle
  private viewInitialized = false;
  private sessionActive = false;

  constructor(
    private chatbotService: ChatbotService,
    private speechService: SpeechService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadSpeechSDK();
    
    // Listener para teste manual
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

  /**
   * Carrega o SDK do Azure Speech
   */
  private loadSpeechSDK() {
    if (typeof SpeechSDK === 'undefined') {
      console.log('⏳ Carregando Azure Speech SDK...');
      const script = document.createElement('script');
      script.src = 'https://aka.ms/csspeech/jsbrowserpackageraw';
      script.onload = () => {
        console.log('✅ Azure Speech SDK carregado');
        setTimeout(() => this.initializeAvatarConfig(), 100);
      };
      script.onerror = () => {
        this.setError('Erro ao carregar Azure Speech SDK');
      };
      document.head.appendChild(script);
    } else {
      console.log('✅ Azure Speech SDK já estava carregado');
      this.initializeAvatarConfig();
    }
  }

  /**
   * Força atualização da interface
   */
  private forceUIUpdate(): void {
    this.cdr.detectChanges();
    setTimeout(() => this.cdr.markForCheck(), 0);
  }

  /**
   * Inicializa a configuração do avatar
   */
  private async initializeAvatarConfig() {
    try {
      console.log('🔧 Inicializando configuração do avatar...');
      
      // Verificações das credenciais
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
      
      // Configuração do formato de vídeo com crop otimizado
      console.log('🎥 Configurando video format e crop...');
      const videoFormat = new SpeechSDK.AvatarVideoFormat();
      
      // Valores para centralizar o avatar com fundo branco
      let videoCropTopLeftX = 400;
      let videoCropTopLeftY = 0;
      let videoCropBottomRightX = 1520;
      let videoCropBottomRightY = 1080;
      
      videoFormat.setCropRange(
        new SpeechSDK.Coordinate(videoCropTopLeftX, videoCropTopLeftY), 
        new SpeechSDK.Coordinate(videoCropBottomRightX, videoCropBottomRightY)
      );

      // Configuração do avatar
      this.avatarConfig = new SpeechSDK.AvatarConfig(
        environment.azure.avatar.character,
        environment.azure.avatar.style,
        videoFormat
      );
      
      // Configurar fundo branco
      this.avatarConfig.backgroundColor = '#FFFFFFFF';
      
      // Avatar customizado se habilitado
      if (environment.azure.avatar.custom.enabled) {
        this.avatarConfig.customized = true;
        console.log('👤 Avatar customizado habilitado');
      }

      console.log('✅ Configuração do avatar inicializada');
      
    } catch (error) {
      console.error('❌ Erro ao inicializar configuração do avatar:', error);
      this.setError(`Erro na configuração: ${error}`);
      throw error;
    }
  } 

  /**
   * Valida as credenciais do Azure
   */
  private async validateAzureCredentials(): Promise<boolean> {
    try {
      console.log('🔍 Validando credenciais Azure...');
      
      const testConfig = SpeechSDK.SpeechConfig.fromSubscription(
        environment.azure.speechKey,
        environment.azure.speechRegion
      );
      
      const testSynthesizer = new SpeechSDK.SpeechSynthesizer(testConfig);
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('⏰ Timeout na validação de credenciais');
          testSynthesizer.close();
          resolve(false);
        }, 5000);
        
        try {
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

  /**
   * Maximiza o avatar e inicia conexão automática
   */
  async maximizeAndConnect() {
    console.log('🔄 Maximizando avatar e conectando...');
    this.isMinimized = false;
    
    setTimeout(() => {
      if (!this.isConnected && !this.isLoading) {
        console.log('🚀 Iniciando conexão automática...');
        this.connectAvatar();
      } else {
        console.log('ℹ️ Avatar já está conectado ou conectando');
      }
    }, 500);
  }

  /**
   * Minimiza o avatar (mantém conexão ativa)
   */
  minimizeAvatar() {
    this.isMinimized = true;
  }

  /**
   * Conecta o avatar ao Azure Speech Service
   */
  private async connectAvatar() {
    console.log('🔌 Tentando conectar avatar...');
    
    if (this.isConnected || this.isLoading) {
      console.log('ℹ️ Avatar já está conectado ou carregando');
      return;
    }

    if (!this.viewInitialized || !this.avatarCanvas) {
      console.warn('⚠️ Avatar canvas não está pronto, tentando novamente em 1s...');
      setTimeout(() => this.connectAvatar(), 1000);
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Conectando avatar...';
    this.clearError();

    try {
      // Configurar canvas
      console.log('🎨 Configurando canvas...');
      const canvas = this.avatarCanvas.nativeElement;
      this.canvasContext = canvas.getContext('2d');
      canvas.width = 380;
      canvas.height = 240;

      // Obter credenciais ICE do Azure
      console.log('🔑 Obtendo credenciais ICE do Azure...');
      const iceCredentials = await this.getAzureIceCredentials();
      
      if (!iceCredentials) {
        throw new Error('Falha ao obter credenciais ICE do Azure');
      }

      // Criar WebRTC connection com servidores ICE do Azure
      console.log('🌐 Criando WebRTC connection...');
      this.peerConnection = new RTCPeerConnection({
        iceServers: [{
          urls: [iceCredentials.iceServerUrl],
          username: iceCredentials.iceServerUsername,
          credential: iceCredentials.iceServerCredential
        }]
      });

      // Configurar eventos WebRTC
      this.setupWebRTCEvents();

      // Adicionar transceivers
      console.log('📡 Adicionando transceivers...');
      this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
      this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

      // Criar avatar synthesizer
      console.log('🤖 Criando avatar synthesizer...');
      this.avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(
        this.speechConfig, 
        this.avatarConfig
      );

      // Configurar eventos do avatar
      this.setupAvatarEvents();

      // Iniciar conexão do avatar
      console.log('🔗 Iniciando conexão do avatar...');
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

  /**
   * Configura eventos do WebRTC
   */
  private setupWebRTCEvents(): void {
    if (!this.peerConnection) return;

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
        console.log('🎥 Configurando stream de vídeo...');
        this.avatarVideo.nativeElement.srcObject = event.streams[0];
        this.avatarVideo.nativeElement.onloadedmetadata = () => {
          console.log('📺 Vídeo metadata carregado');
          this.startVideoProcessing();
        };
      } 
      else if (event.track.kind === 'audio' && this.avatarAudio && event.streams[0]) {
        console.log('🔊 Configurando stream de áudio...');
        this.setupAudioStream(event.streams[0]);
      }
    };
  }

  /**
   * Configura eventos do avatar synthesizer
   */
  private setupAvatarEvents(): void {
    if (!this.avatarSynthesizer) return;

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
  }

  /**
   * Configura o stream de áudio
   */
  private setupAudioStream(stream: MediaStream): void {
    const audioElement = this.avatarAudio.nativeElement;
    
    audioElement.srcObject = stream;
    audioElement.autoplay = true;
    audioElement.muted = false;
    audioElement.volume = 1.0;
    audioElement.controls = false;
    
    audioElement.onloadedmetadata = () => {
      console.log('🔊 Áudio metadata carregado');
      
      audioElement.play()
        .then(() => {
          console.log('✅ Áudio iniciado com sucesso!');
        })
        .catch(error => {
          console.error('❌ Erro ao iniciar áudio:', error);
          this.waitForUserInteractionToEnableAudio();
        });
    };
    
    audioElement.onerror = (error) => {
      console.error('❌ Erro no elemento de áudio:', error);
    };
  }

  /**
   * Aguarda interação do usuário para ativar áudio
   */
  private waitForUserInteractionToEnableAudio(): void {
    console.log('⚠️ Áudio bloqueado pelo navegador. Aguardando interação do usuário...');
    
    const enableAudio = () => {
      if (this.avatarAudio?.nativeElement) {
        console.log('🔄 Tentando ativar áudio após interação...');
        
        this.avatarAudio.nativeElement.play()
          .then(() => {
            console.log('✅ Áudio ativado após interação!');
            document.removeEventListener('click', enableAudio);
            document.removeEventListener('keydown', enableAudio);
          })
          .catch(error => {
            console.error('❌ Ainda não foi possível ativar áudio:', error);
          });
      }
    };
    
    document.addEventListener('click', enableAudio, { once: true });
    document.addEventListener('keydown', enableAudio, { once: true });
    
    this.setError('Clique em qualquer lugar para ativar o áudio');
  }

  /**
   * Obtém credenciais ICE do Azure
   */
  private async getAzureIceCredentials(): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
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
      
      xhr.timeout = 10000;
      xhr.send();
    });
  }

  /**
   * Inicia conexão do avatar usando Promise
   */
  private startAvatarConnectionWithPromise(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('📡 Chamando startAvatarAsync com Promise...');
      
      const timeoutId = setTimeout(() => {
        console.log('⏰ Timeout de 30 segundos atingido');
        resolve(false);
      }, 30000);

      this.avatarSynthesizer.startAvatarAsync(this.peerConnection)
        .then((result: any) => {
          clearTimeout(timeoutId);
          
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

  /**
   * Inicia processamento de vídeo no canvas
   */
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

  /**
   * Envia mensagem para o chatbot
   */
  async sendMessage() {
    const message = this.inputText.trim();
    if (!message || !this.isConnected) return;

    // Interromper fala atual quando usuário envia nova mensagem
    this.interruptForNewMessage();

    this.addMessage('user', message);
    this.inputText = '';

    try {
      const response = await this.chatbotService.sendMessage(message);
      
      if (typeof response === 'string') {
        this.addMessage('assistant', response);
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
      await this.speakText(errorMsg);
    }
  }

  /**
   * Adiciona mensagem ao histórico do chat
   */
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

  /**
   * Faz o avatar falar o texto fornecido
   */
  private async speakText(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.avatarSynthesizer || !this.isConnected) {
        console.warn('⚠️ Avatar não conectado ou synthesizer não disponível');
        resolve();
        return;
      }

      // Interromper fala atual se estiver falando
      if (this.isCurrentlySpeaking) {
        console.log('🔇 Interrompendo fala atual para nova mensagem');
        this.stopCurrentSpeech();
      }

      // Limpar fila - não acumular mensagens
      this.speechQueue = [];

      this.speakTextNow(text)
        .then(() => resolve())
        .catch(error => reject(error));
    });
  }

  /**
   * Para a fala atual do avatar
   */
  private stopCurrentSpeech(): void {
    if (!this.isCurrentlySpeaking || !this.avatarSynthesizer) return;

    console.log('🔇 Parando fala atual...');
    
    try {
      this.avatarSynthesizer.stopSpeakingAsync()
        .then(() => {
          console.log('✅ Fala atual interrompida');
        })
        .catch((error: any) => {
          console.error('❌ Erro ao parar fala:', error);
        })
        .finally(() => {
          this.isCurrentlySpeaking = false;
          this.isSpeaking = false;
        });
    } catch (error) {
      console.error('❌ Erro ao interromper fala:', error);
      this.isCurrentlySpeaking = false;
      this.isSpeaking = false;
    }
  }

  /**
   * Fala o texto imediatamente
   */
  private async speakTextNow(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.avatarSynthesizer || !this.isConnected) {
        reject(new Error('Avatar não conectado'));
        return;
      }

      console.log('🗣️ Iniciando nova fala:', text.substring(0, 50) + '...');
      
      this.isCurrentlySpeaking = true;
      this.isSpeaking = true;

      const cleanText = text.replace(/[<>]/g, '').trim();
      if (!cleanText) {
        this.finishCurrentSpeech();
        resolve();
        return;
      }

      const ssml = this.createOptimizedSSML(cleanText);

      const speechTimeout = setTimeout(() => {
        console.warn('⏰ Timeout na fala, finalizando...');
        this.finishCurrentSpeech();
        reject(new Error('Timeout na síntese de fala'));
      }, 30000);

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

  /**
   * Finaliza a fala atual
   */
  private finishCurrentSpeech(): void {
    this.isCurrentlySpeaking = false;
    this.isSpeaking = false;
    console.log('✅ Fala atual finalizada');
  }

  /**
   * Cria SSML otimizado para o avatar
   */
  private createOptimizedSSML(text: string): string {
    const voiceName = environment.azure.avatar.voiceName;
    
    // Escapar caracteres especiais
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="pt-BR">
      <voice name="${voiceName}">
        <mstts:leadingsilence-exact value="0"/>
        <prosody rate="0.9" pitch="+2%">
          ${escapedText}
        </prosody>
      </voice>
    </speak>`;
  }

  /**
   * Para toda a fala do avatar
   */
  public stopSpeaking(): void {
    console.log('🔇 Comando para parar toda fala...');
    this.speechQueue = [];
    this.stopCurrentSpeech();
  }

  /**
   * Interrompe fala para nova mensagem do usuário
   */
  private interruptForNewMessage(): void {
    if (this.isCurrentlySpeaking) {
      console.log('🔄 Interrompendo fala para nova mensagem do usuário');
      this.stopCurrentSpeech();
    }
  }

  /**
   * Alterna estado do microfone
   */
  async toggleMicrophone() {
    if (this.isListening) {
      console.log('🔄 Usuário solicitou parada do microfone...');
      await this.stopListeningCompletely();
    } else {
      console.log('🔄 Usuário solicitou abertura do microfone...');
      await this.startListening();
    }
  }

  /**
   * Inicia reconhecimento de voz
   */
  private async startListening() {
    if (this.isListening) {
      console.warn('⚠️ Reconhecimento já está ativo, ignorando...');
      return;
    }

    // Verificação robusta do estado do speech service
    if (this.speechService.isRecognitionActive()) {
      console.log('🔄 Speech service ainda ativo, tentando parada normal...');
      await this.stopListeningCompletely();
      
      if (this.speechService.isRecognitionActive()) {
        console.warn('⚠️ Speech service não parou, usando força bruta...');
        await this.forceResetMicrophone();
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    try {
      const success = await this.speechService.startContinuousRecognition({
        onResult: (result: SpeechRecognitionResult) => {
          this.lastAudioActivity = Date.now();
          this.resetSilenceTimer();
          
          if (result.isFinal && result.text.trim()) {
            console.log('✅ Texto final reconhecido, fechando microfone...');
            
            this.voiceText = '';
            this.inputText = result.text;
            
            this.stopListeningCompletely().then(() => {
              setTimeout(() => {
                this.sendMessage();
              }, 100);
            });
          } else {
            this.voiceText = result.text;
          }
        },
        onError: (error: string) => {
          console.error('❌ Erro no reconhecimento de voz:', error);
          this.setError('Erro no reconhecimento de voz');
          this.forceResetMicrophone();
        },
        onStart: () => {
          this.isListening = true;
          console.log('🎤 Reconhecimento de voz iniciado');
          this.forceUIUpdate();
          
          this.startSilenceDetection();
          this.interruptForNewMessage();
        },
        onStop: () => {
          this.isListening = false;
          this.voiceText = '';
          console.log('🔇 Reconhecimento de voz parado');
          this.forceUIUpdate();
          
          this.stopSilenceDetection();
        }
      });

      if (!success) {
        this.isListening = false;
        this.forceUIUpdate();
        this.setError('Não foi possível iniciar o reconhecimento de voz');
      }
    } catch (error) {
      console.error('❌ Erro ao iniciar reconhecimento:', error);
      this.isListening = false;
      this.forceUIUpdate();
      this.setError('Erro ao acessar o microfone');
    }
  }

  /**
   * Inicia detecção de silêncio
   */
  private async startSilenceDetection(): Promise<void> {
    try {
      console.log('🔍 Iniciando detecção de silêncio...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      
      this.analyser.fftSize = 256;
      this.microphone.connect(this.analyser);
      
      this.isDetectingSilence = true;
      this.lastAudioActivity = Date.now();
      this.monitorAudioLevel();
      
      console.log('✅ Detecção de silêncio ativa');
      
    } catch (error) {
      console.error('❌ Erro ao iniciar detecção de silêncio:', error);
    }
  }

  /**
   * Monitora nível de áudio para detectar silêncio
   */
  private monitorAudioLevel(): void {
    if (!this.isDetectingSilence || !this.analyser) return;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkAudioLevel = () => {
      if (!this.isDetectingSilence || !this.analyser) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const audioThreshold = 20;
      
      if (average > audioThreshold) {
        this.lastAudioActivity = Date.now();
        this.resetSilenceTimer();
      } else {
        const silenceDuration = Date.now() - this.lastAudioActivity;
        
        if (silenceDuration >= this.silenceThreshold) {
          console.log('🔇 Silêncio prolongado detectado, fechando microfone...');
          this.stopListeningCompletely();
          return;
        }
      }
      
      requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
  }

  /**
   * Para detecção de silêncio
   */
  private stopSilenceDetection(): void {
    console.log('🛑 Parando detecção de silêncio...');
    
    this.isDetectingSilence = false;
    this.clearSilenceTimer();
    
    if (this.isListening) {
      this.isListening = false;
      this.forceUIUpdate();
    }
    
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
  }

  /**
   * Reseta timer de silêncio
   */
  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    
    this.silenceTimer = setTimeout(() => {
      if (this.isListening) {
        console.log('⏰ Timer de silêncio expirou, fechando microfone...');
        this.stopListeningCompletely();
      }
    }, this.silenceThreshold);
  }

  /**
   * Limpa timer de silêncio
   */
  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * Para reconhecimento de voz completamente
   */
  private async stopListeningCompletely(): Promise<void> {
    console.log('🛑 Parando reconhecimento COMPLETAMENTE...');
    
    this.isListening = false;
    this.voiceText = '';
    this.forceUIUpdate();
    
    this.stopSilenceDetection();
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (this.speechService.isRecognitionActive() && attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 Tentativa ${attempts} de parar speech service...`);
      
      try {
        await this.speechService.stopContinuousRecognition();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!this.speechService.isRecognitionActive()) {
          console.log('✅ Speech service parado com sucesso');
          break;
        }
      } catch (error) {
        console.error(`❌ Erro na tentativa ${attempts}:`, error);
      }
    }
    
    if (this.speechService.isRecognitionActive()) {
      console.error('❌ Não foi possível parar o speech service após todas as tentativas');
    }
    
    console.log('✅ Parada completa finalizada');
  }

  /**
   * Força reset do microfone
   */
  public async forceResetMicrophone(): Promise<void> {
    console.log('💥 FORÇA BRUTA: Resetando microfone completamente...');
    
    this.stopSilenceDetection();
    
    this.isListening = false;
    this.voiceText = '';
    this.forceUIUpdate();
    
    this.speechService.forceReset();
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('✅ Reset forçado do microfone concluído');
  }

  /**
   * Configura sensibilidade de silêncio
   */
  public setSilenceSensitivity(seconds: number): void {
    this.silenceThreshold = seconds * 1000;
    console.log(`🔧 Sensibilidade de silêncio ajustada para ${seconds} segundos`);
  }

  /**
   * Retorna status da conexão
   */
  getConnectionStatus(): string {
    if (this.isLoading) return 'Conectando...';
    return this.isConnected ? 'Conectado' : 'Desconectado';
  }

  /**
   * Define mensagem de erro
   */
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

  /**
   * Limpa mensagem de erro
   */
  clearError() {
    this.errorMessage = '';
  }

  /**
   * Limpa todos os recursos do componente
   */
  private cleanup(): void {
    console.log('🧹 Limpando recursos do avatar...');
    
    this.stopListeningCompletely();
    this.stopSpeaking();
    
    if (this.avatarSynthesizer) {
      try {
        this.avatarSynthesizer.close();
      } catch (e) {
        console.warn('⚠️ Erro ao fechar synthesizer:', e);
      }
      this.avatarSynthesizer = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        console.warn('⚠️ Erro ao fechar peer connection:', e);
      }
      this.peerConnection = null;
    }

    // Resetar todos os estados
    this.isConnected = false;
    this.sessionActive = false;
    this.isSpeaking = false;
    this.isListening = false;
    this.isLoading = false;
    this.isCurrentlySpeaking = false;
    this.isDetectingSilence = false;
    
    this.forceUIUpdate();
    
    console.log('✅ Limpeza concluída');
  }

  /**
   * Testa configuração de áudio (método de debug)
   */
  public testAudio(): void {
    console.log('🧪 Testando configuração de áudio...');
    
    if (!this.avatarAudio) {
      console.error('❌ Elemento de áudio não encontrado');
      return;
    }
    
    const audioElement = this.avatarAudio.nativeElement;
    
    console.log('🔊 Estado atual do áudio:', {
      srcObject: !!audioElement.srcObject,
      volume: audioElement.volume,
      muted: audioElement.muted,
      paused: audioElement.paused,
      readyState: audioElement.readyState,
      autoplay: audioElement.autoplay
    });
    
    if (audioElement.srcObject) {
      const stream = audioElement.srcObject as MediaStream;
      console.log('🎵 Stream de áudio:', {
        active: stream.active,
        audioTracks: stream.getAudioTracks().length,
        tracks: stream.getAudioTracks().map(track => ({
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        }))
      });
    }
  }

  /**
   * Força reprodução de áudio (método de debug)
   */
  public forceAudioPlayback(): void {
    console.log('🔄 Forçando reprodução de áudio...');
    
    if (!this.avatarAudio?.nativeElement) {
      console.error('❌ Elemento de áudio não disponível');
      return;
    }
    
    const audioElement = this.avatarAudio.nativeElement;
    
    audioElement.muted = false;
    audioElement.volume = 1.0;
    
    audioElement.play()
      .then(() => {
        console.log('✅ Áudio forçado com sucesso!');
      })
      .catch(error => {
        console.error('❌ Erro ao forçar áudio:', error);
        this.createFallbackAudioElement();
      });
  }

  /**
   * Cria elemento de áudio fallback
   */
  private createFallbackAudioElement(): void {
    console.log('🆘 Criando elemento de áudio fallback...');
    
    const fallbackAudio = document.createElement('audio');
    fallbackAudio.autoplay = true;
    fallbackAudio.volume = 1.0;
    fallbackAudio.muted = false;
    fallbackAudio.style.display = 'none';
    document.body.appendChild(fallbackAudio);
    
    if (this.avatarAudio?.nativeElement.srcObject) {
      fallbackAudio.srcObject = this.avatarAudio.nativeElement.srcObject;
      
      fallbackAudio.onplay = () => {
        console.log('✅ Áudio fallback funcionando!');
      };
      
      fallbackAudio.play()
        .then(() => {
          console.log('✅ Fallback audio iniciado!');
        })
        .catch(error => {
          console.error('❌ Fallback também falhou:', error);
        });
    }
  }

  /**
   * Obtém status da fala (método de debug)
   */
  public getSpeechStatus(): { isCurrentlySpeaking: boolean } {
    return {
      isCurrentlySpeaking: this.isCurrentlySpeaking
    };
  }

  /**
   * Debug do estado do microfone
   */
  public debugMicrophoneState(): void {
    console.log('🐛 Debug Microphone State:', {
      isListening: this.isListening,
      voiceText: this.voiceText,
      isDetectingSilence: this.isDetectingSilence,
      speechServiceActive: this.speechService.isRecognitionActive(),
      audioContext: !!this.audioContext,
      analyser: !!this.analyser,
      microphone: !!this.microphone,
      lastActivity: new Date(this.lastAudioActivity).toLocaleTimeString()
    });
    
    // Ação corretiva se estado inconsistente
    if (this.isListening && !this.speechService.isRecognitionActive()) {
      console.warn('⚠️ Estado inconsistente: UI mostra ouvindo mas service parado');
      this.isListening = false;
      this.forceUIUpdate();
    } else if (!this.isListening && this.speechService.isRecognitionActive()) {
      console.warn('⚠️ Estado inconsistente: UI mostra parado mas service ativo');
      this.stopListeningCompletely();
    }
  }
}