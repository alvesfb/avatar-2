// src/app/services/chatbot.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Interface para mensagens do chat
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

/**
 * Interface para resposta do chatbot
 */
export interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
  streaming?: boolean;
}

/**
 * Serviço responsável pela comunicação com a API do chatbot
 * Gerencia histórico de conversas e processamento de respostas
 */
@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private messages: ChatMessage[] = [];
  private conversationId: string = this.generateConversationId();

  constructor() {
    this.initializeSystemMessage();
  }

  /**
   * Inicializa mensagem do sistema que define o comportamento do assistente
   */
  private initializeSystemMessage(): void {
    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'Você é um assistente virtual útil e amigável. Responda de forma clara e concisa em português brasileiro.',
      timestamp: new Date()
    };
    this.messages.push(systemMessage);
  }

  /**
   * Gera ID único para a conversa
   */
  private generateConversationId(): string {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Envia mensagem para o chatbot e retorna resposta
   * @param userMessage - Mensagem do usuário
   * @returns Promise com stream de resposta ou string completa
   */
  async sendMessage(userMessage: string): Promise<ReadableStream<string> | string> {
    if (!userMessage.trim()) {
      throw new Error('Mensagem não pode estar vazia');
    }

    // Adiciona mensagem do usuário ao histórico
    const userChatMessage: ChatMessage = {
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date()
    };
    this.messages.push(userChatMessage);

    try {
      // Prepara payload para a API
      const payload = {
        data: {
          input: userMessage,
          context: {
            conversation_id: this.conversationId,
            system: {
              dialog_turn_counter: this.messages.filter(m => m.role === 'user').length
            },
            metadata: {
              user_id: this.generateUserId()
            },
            total_context: this.messages.length,
            messages: this.messages.slice(-10) // Últimas 10 mensagens para contexto
          },
          config: {
            max_tokens: environment.chatbot.maxTokens
          }
        }
      };

      // Faz requisição para a API
      const response = await fetch(environment.chatbot.apiUrl, {
        method: 'POST',
        headers: environment.chatbot.headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(environment.chatbot.timeout)
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
      }

      // Verifica se deve usar streaming ou resposta completa
      if (environment.chatbot.streaming && response.body) {
        return this.handleStreamingResponse(response.body);
      } else {
        const data = await response.json();
        const assistantMessage = this.extractMessageFromResponse(data);
        
        // Adiciona resposta do assistente ao histórico
        this.messages.push({
          role: 'assistant',
          content: assistantMessage,
          timestamp: new Date()
        });

        return assistantMessage;
      }
    } catch (error) {
      console.error('Erro no ChatbotService:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return environment.chatbot.fallbackMessages.timeout;
        }
        return environment.chatbot.fallbackMessages.error;
      }
      
      return environment.chatbot.fallbackMessages.apiUnavailable;
    }
  }

  /**
   * Processa resposta em streaming da API
   * @param body - Stream de dados da resposta
   * @returns ReadableStream processado
   */
  private handleStreamingResponse(body: ReadableStream<Uint8Array>): ReadableStream<string> {
    const reader = body.getReader();
    let assistantMessage = '';
    const self = this;

    return new ReadableStream<string>({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Adiciona mensagem completa ao histórico quando terminar
              if (assistantMessage.trim()) {
                self.messages.push({
                  role: 'assistant',
                  content: assistantMessage,
                  timestamp: new Date()
                });
              }
              controller.close();
              break;
            }

            // Processa chunk recebido
            const chunk = new TextDecoder().decode(value);
            const processedChunk = self.processStreamChunk(chunk);
            
            if (processedChunk) {
              assistantMessage += processedChunk;
              controller.enqueue(processedChunk);
            }
          }
        } catch (error) {
          console.error('Erro no streaming:', error);
          controller.error(error);
        }
      }
    });
  }

  /**
   * Processa um chunk individual do stream
   * @param chunk - Dados brutos do chunk
   * @returns Texto processado ou string vazia
   */
  private processStreamChunk(chunk: string): string {
    try {
      const responseData = JSON.parse(chunk);
      
      if (responseData.data && responseData.data.output && responseData.data.output.text) {
        let text = responseData.data.output.text[0] || '';
        
        // Limpa quebras de linha e aplica substituições
        text = text.replace(/\\n\\n?/g, ' ');
        text = this.applyTextReplacements(text);
        
        return text;
      }
    } catch (error) {
      console.warn('Erro ao processar chunk:', error);
    }
    
    return '';
  }

  /**
   * Aplica substituições de texto específicas para correções de pronúncia
   * @param text - Texto original
   * @returns Texto com substituições aplicadas
   */
  private applyTextReplacements(text: string): string {
    return text
      .replace(/primeclass/ig, 'praime class')
      .replace(/priority/ig, 'praióriti')
      .replace(/diners/ig, 'dáiners')
      .replace(/altus/ig, 'altos')
      .replace(/prime/ig, 'praime');
  }

  /**
   * Extrai mensagem da resposta da API
   * @param data - Dados da resposta
   * @returns Mensagem extraída ou mensagem de erro
   */
  private extractMessageFromResponse(data: any): string {
    // Tenta extrair da estrutura padrão da API
    if (data.data && data.data.output && data.data.output.text) {
      return data.data.output.text[0] || environment.chatbot.fallbackMessages.error;
    }
    
    // Fallback para estrutura alternativa
    if (data.message) {
      return data.message;
    }
    
    return environment.chatbot.fallbackMessages.error;
  }

  /**
   * Gera ou recupera ID único do usuário
   * @returns ID do usuário
   */
  private generateUserId(): string {
    let userId = localStorage.getItem('chatbot_user_id');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chatbot_user_id', userId);
    }
    return userId;
  }

  /**
   * Retorna histórico completo da conversa
   * @returns Array com todas as mensagens
   */
  getConversationHistory(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * Limpa histórico da conversa e reinicia com nova ID
   */
  clearConversation(): void {
    this.messages = [];
    this.conversationId = this.generateConversationId();
    this.initializeSystemMessage();
  }

  /**
   * Retorna ID da conversa atual
   * @returns ID da conversa
   */
  getConversationId(): string {
    return this.conversationId;
  }
}