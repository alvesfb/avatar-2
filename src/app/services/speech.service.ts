// src/app/services/speech.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare var SpeechSDK: any;

export interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private speechConfig: any;
  private audioConfig: any;
  private speechRecognizer: any;
  private isRecognizing: boolean = false;
  private recognitionCallbacks: {
    onResult?: (result: SpeechRecognitionResult) => void;
    onError?: (error: string) => void;
    onStart?: () => void;
    onStop?: () => void;
  } = {};

  constructor() {
    this.initializeSpeechConfig();
  }

  private initializeSpeechConfig(): void {
    if (typeof SpeechSDK === 'undefined') {
      console.error('Azure Speech SDK não está carregado');
      return;
    }

    try {
      // Configuração do Speech Service
      this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        environment.azure.speechKey,
        environment.azure.speechRegion
      );

      // Configurações de reconhecimento
      this.speechConfig.speechRecognitionLanguage = environment.azure.speechRecognition.language;
      
      if (environment.azure.speechRecognition.enableAutomaticPunctuation) {
        this.speechConfig.setProperty(
          SpeechSDK.PropertyId.SpeechServiceConnection_EnableAutomaticPunctuation,
          'true'
        );
      }

      // Configuração de áudio do microfone
      this.audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      console.log('✅ Speech Service configurado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao configurar Speech Service:', error);
    }
  }

  async startContinuousRecognition(callbacks: {
    onResult?: (result: SpeechRecognitionResult) => void;
    onError?: (error: string) => void;
    onStart?: () => void;
    onStop?: () => void;
  } = {}): Promise<boolean> {
    if (this.isRecognizing) {
      console.warn('Reconhecimento já está ativo');
      return false;
    }

    if (!this.speechConfig || !this.audioConfig) {
      const error = 'Speech Service não está configurado corretamente';
      console.error(error);
      callbacks.onError?.(error);
      return false;
    }

    try {
      // Solicita permissão para microfone
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        const error = 'Permissão para microfone negada';
        callbacks.onError?.(error);
        return false;
      }

      this.recognitionCallbacks = callbacks;

      // Cria o reconhecedor
      this.speechRecognizer = new SpeechSDK.SpeechRecognizer(
        this.speechConfig,
        this.audioConfig
      );

      // Configura eventos
      this.setupRecognitionEvents();

      // Inicia reconhecimento contínuo
      this.speechRecognizer.startContinuousRecognitionAsync(
        () => {
          this.isRecognizing = true;
          console.log('🎤 Reconhecimento contínuo iniciado');
          this.recognitionCallbacks.onStart?.();
        },
        (error: any) => {
          console.error('❌ Erro ao iniciar reconhecimento:', error);
          this.recognitionCallbacks.onError?.(error.toString());
          this.isRecognizing = false;
        }
      );

      return true;
    } catch (error) {
      console.error('❌ Erro no startContinuousRecognition:', error);
      this.recognitionCallbacks.onError?.(error instanceof Error ? error.message : 'Erro desconhecido');
      return false;
    }
  }

  async stopContinuousRecognition(): Promise<void> {
    console.log('🔄 Iniciando parada do reconhecimento contínuo...');
    console.log('📊 Estado atual:', {
      isRecognizing: this.isRecognizing,
      hasRecognizer: !!this.speechRecognizer
    });

    if (!this.isRecognizing || !this.speechRecognizer) {
      console.log('ℹ️ Reconhecimento já está parado ou recognizer não existe');
      this.isRecognizing = false;
      return;
    }

    return new Promise<void>((resolve) => {
      console.log('🛑 Enviando comando de parada para speechRecognizer...');
      
      // ✅ TIMEOUT de segurança para evitar travamento
      const stopTimeout = setTimeout(() => {
        console.warn('⏰ Timeout ao parar reconhecimento, forçando parada...');
        this.isRecognizing = false;
        this.cleanup();
        resolve();
      }, 3000); // 3 segundos de timeout

      this.speechRecognizer.stopContinuousRecognitionAsync(
        () => {
          clearTimeout(stopTimeout);
          console.log('✅ Reconhecimento contínuo parado com sucesso');
          this.isRecognizing = false;
          this.recognitionCallbacks.onStop?.();
          this.cleanup();
          resolve();
        },
        (error: any) => {
          clearTimeout(stopTimeout);
          console.error('❌ Erro ao parar reconhecimento:', error);
          this.isRecognizing = false;
          this.cleanup();
          resolve(); // Resolver mesmo com erro para não travar
        }
      );
    });
  }

  private setupRecognitionEvents(): void {
    if (!this.speechRecognizer) return;

    // Resultado final do reconhecimento
    this.speechRecognizer.recognized = (sender: any, e: any) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
        console.log('🗣️ Texto reconhecido:', e.result.text);
        
        const result: SpeechRecognitionResult = {
          text: e.result.text,
          confidence: e.result.confidence || 1.0,
          isFinal: true
        };
        
        this.recognitionCallbacks.onResult?.(result);
      }
    };

    // Resultado intermediário (em tempo real)
    this.speechRecognizer.recognizing = (sender: any, e: any) => {
      if (e.result.text) {
        const result: SpeechRecognitionResult = {
          text: e.result.text,
          confidence: e.result.confidence || 0.5,
          isFinal: false
        };
        
        this.recognitionCallbacks.onResult?.(result);
      }
    };

    // Eventos de erro
    this.speechRecognizer.canceled = (sender: any, e: any) => {
      console.error('❌ Reconhecimento cancelado:', e.reason, e.errorDetails);
      
      if (e.reason === SpeechSDK.CancellationReason.Error) {
        this.recognitionCallbacks.onError?.(e.errorDetails || 'Erro no reconhecimento de fala');
      }
      
      this.isRecognizing = false;
    };

    // Evento de sessão iniciada
    this.speechRecognizer.sessionStarted = (sender: any, e: any) => {
      console.log('🎙️ Sessão de reconhecimento iniciada');
    };

    // Evento de sessão parada
    this.speechRecognizer.sessionStopped = (sender: any, e: any) => {
      console.log('🔇 Sessão de reconhecimento parada');
      this.isRecognizing = false;
      this.recognitionCallbacks.onStop?.();
    };
  }

  private async requestMicrophonePermission(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('getUserMedia não é suportado neste navegador');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Para o stream imediatamente (só queríamos a permissão)
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao solicitar permissão do microfone:', error);
      return false;
    }
  }

  private cleanup(): void {
    console.log('🧹 Limpando speech recognizer...');
    
    if (this.speechRecognizer) {
      try {
        // ✅ FORÇAR fechamento do recognizer
        this.speechRecognizer.close();
        console.log('✅ Speech recognizer fechado');
      } catch (error) {
        console.error('❌ Erro ao fechar speech recognizer:', error);
      }
      this.speechRecognizer = null;
    }
    
    this.recognitionCallbacks = {};
    this.isRecognizing = false;
    
    console.log('✅ Cleanup do speech service concluído');
  }

  // ADICIONAR método de força bruta para resetar o speech service:
  public forceReset(): void {
    console.log('💥 FORÇANDO reset completo do speech service...');
    
    // Parar tudo imediatamente
    this.isRecognizing = false;
    
    // Fechar recognizer se existir
    if (this.speechRecognizer) {
      try {
        this.speechRecognizer.close();
      } catch (error) {
        console.error('Erro ao fechar recognizer durante reset:', error);
      }
      this.speechRecognizer = null;
    }
    
    // Limpar callbacks
    this.recognitionCallbacks = {};
    
    // Recriar configurações
    this.initializeSpeechConfig();
    
    console.log('✅ Reset forçado concluído');
  }

  isRecognitionActive(): boolean {
    return this.isRecognizing;
  }

  // Método para reconhecimento único (não contínuo)
  async recognizeOnce(): Promise<string> {
    if (!this.speechConfig || !this.audioConfig) {
      throw new Error('Speech Service não está configurado');
    }

    return new Promise<string>((resolve, reject) => {
      const recognizer = new SpeechSDK.SpeechRecognizer(
        this.speechConfig,
        this.audioConfig
      );

      recognizer.recognizeOnceAsync(
        (result: any) => {
          recognizer.close();
          
          if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            resolve(result.text);
          } else {
            reject(new Error('Não foi possível reconhecer a fala'));
          }
        },
        (error: any) => {
          recognizer.close();
          reject(new Error(error));
        }
      );
    });
  }

  ngOnDestroy(): void {
    this.stopContinuousRecognition();
    this.cleanup();
  }
}