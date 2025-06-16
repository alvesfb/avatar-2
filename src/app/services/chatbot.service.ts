// src/app/services/chatbot.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
  streaming?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private messages: ChatMessage[] = [];
  private conversationId: string = this.generateConversationId();

  constructor() {
    this.initializeSystemMessage();
  }

  private initializeSystemMessage(): void {
    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'Você é um assistente virtual útil e amigável. Responda de forma clara e concisa em português brasileiro.',
      timestamp: new Date()
    };
    this.messages.push(systemMessage);
  }

  private generateConversationId(): string {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

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
      // Prepara o payload baseado no exemplo_chattxt.txt
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

      // Faz a requisição
      const response = await fetch(environment.chatbot.apiUrl, {
        method: 'POST',
        headers: environment.chatbot.headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(environment.chatbot.timeout)
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
      }

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

  private handleStreamingResponse(body: ReadableStream<Uint8Array>): ReadableStream<string> {
    const reader = body.getReader();
    let assistantMessage = '';
    const self = this; // Capturar referência do contexto

    return new ReadableStream<string>({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Adiciona mensagem completa ao histórico
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

            // Processa o chunk
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

  private processStreamChunk(chunk: string): string {
    try {
      // Baseado no processamento do exemplo_chattxt.txt
      const responseData = JSON.parse(chunk);
      
      if (responseData.data && responseData.data.output && responseData.data.output.text) {
        let text = responseData.data.output.text[0] || '';
        
        // Limpa e processa o texto
        text = text.replace(/\\n\\n?/g, ' ');
        text = this.applyTextReplacements(text);
        
        return text;
      }
    } catch (error) {
      console.warn('Erro ao processar chunk:', error);
    }
    
    return '';
  }

  private applyTextReplacements(text: string): string {
    // Baseado nas substituições do exemplo_chattxt.txt
    return text
      .replace(/primeclass/ig, 'praime class')
      .replace(/priority/ig, 'praióriti')
      .replace(/diners/ig, 'dáiners')
      .replace(/altus/ig, 'altos')
      .replace(/prime/ig, 'praime');
  }

  private extractMessageFromResponse(data: any): string {
    // Extrai a mensagem da resposta baseado na estrutura da API
    if (data.data && data.data.output && data.data.output.text) {
      return data.data.output.text[0] || environment.chatbot.fallbackMessages.error;
    }
    
    if (data.message) {
      return data.message;
    }
    
    return environment.chatbot.fallbackMessages.error;
  }

  private generateUserId(): string {
    // Gera ou recupera ID do usuário
    let userId = localStorage.getItem('chatbot_user_id');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chatbot_user_id', userId);
    }
    return userId;
  }

  getConversationHistory(): ChatMessage[] {
    return [...this.messages];
  }

  clearConversation(): void {
    this.messages = [];
    this.conversationId = this.generateConversationId();
    this.initializeSystemMessage();
  }

  getConversationId(): string {
    return this.conversationId;
  }
}