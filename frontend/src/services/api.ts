// services/api.ts
import type { Message } from '@/types/types';

const API_BASE_URL = 'http://localhost:8000';

export const chatAPI = {
  sendMessage: async (messages: Message[], signal: AbortSignal) => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  },

  generateTitle: async (userMessage: string, aiResponse: string) => {
    const response = await fetch(`${API_BASE_URL}/generate-title`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userMessage,
        aiResponse,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
};
