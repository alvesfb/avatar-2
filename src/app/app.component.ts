// src/app/app.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarComponent } from './components/avatar/avatar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, AvatarComponent],
  template: `
    <!-- Interface limpa com apenas o avatar -->
    <div class="app-container">
      <!-- Avatar Component - Sempre presente -->
      <app-avatar
        (statusChange)="onAvatarStatusChange($event)"
        (error)="onAvatarError($event)">
      </app-avatar>
      
      <!-- Mensagens de sistema (opcional, apenas para debug) -->
      <div class="system-messages" *ngIf="showSystemMessages && systemMessage">
        <div class="system-message" [class.error]="systemMessageType === 'error'">
          {{ systemMessage }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      width: 100vw;
      height: 100vh;
      position: relative;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      background-attachment: fixed;
      overflow: hidden;
    }

    .system-messages {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999;
      max-width: 400px;
      width: 90%;
    }

    .system-message {
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #333;
      font-size: 14px;
      text-align: center;
      animation: slideDown 0.3s ease-out;
    }

    .system-message.error {
      background: rgba(220, 53, 69, 0.95);
      color: white;
      border-color: rgba(220, 53, 69, 0.3);
    }

    .debug-controls {
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 998;
    }

    .debug-btn {
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .debug-btn:hover {
      background: white;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Estilo global para remover scrollbars desnecessárias */
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    /* Responsividade */
    @media (max-width: 768px) {
      .system-messages {
        top: 10px;
        width: 95%;
      }
      
      .system-message {
        font-size: 13px;
        padding: 10px 14px;
      }
    }
  `]
})
export class AppComponent {
  // Controle de mensagens do sistema
  systemMessage: string = '';
  systemMessageType: 'info' | 'error' = 'info';
  showSystemMessages: boolean = false; // Desativar em produção
  showDebugControls: boolean = false; // Controles de debug

  constructor() {
    // Log inicial apenas se debug estiver habilitado
    if (!this.isProduction()) {
      console.log('🚀 Avatar Miniatura - LIA inicializado');
      this.showSystemMessages = true;
      this.showDebugControls = true; // Ativar debug em desenvolvimento
    }
  }

  onAvatarStatusChange(status: string) {
    console.log('📊 Status do avatar:', status);
    
    if (this.showSystemMessages) {
      switch (status) {
        case 'connected':
          this.showSystemMessage('Avatar conectado com sucesso', 'info');
          break;
        case 'disconnected':
          this.showSystemMessage('Avatar desconectado', 'info');
          break;
        case 'reconnecting':
          this.showSystemMessage('Reconectando avatar...', 'info');
          break;
      }
    }
  }

  onAvatarError(error: string) {
    console.error('❌ Erro no avatar:', error);
    
    if (this.showSystemMessages) {
      this.showSystemMessage(error, 'error');
    }
  }

  private showSystemMessage(message: string, type: 'info' | 'error' = 'info') {
    this.systemMessage = message;
    this.systemMessageType = type;
    
    // Auto-ocultar mensagem após alguns segundos
    setTimeout(() => {
      this.systemMessage = '';
    }, type === 'error' ? 5000 : 3000);
  }

  private isProduction(): boolean {
    // Verifica se está em ambiente de produção
    return window.location.hostname !== 'localhost' && 
           window.location.hostname !== '127.0.0.1' &&
           !window.location.hostname.includes('dev');
  }

  testAvatarConnection() {
    console.log('🧪 Teste manual de conexão do avatar...');
    // Emitir evento para forçar expansão e conexão do avatar
    const event = new CustomEvent('forceAvatarConnection');
    window.dispatchEvent(event);
  }
}