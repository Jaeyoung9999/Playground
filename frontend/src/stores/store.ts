// store.ts
import { create } from 'zustand';
import type { Message, ChatHistory } from '@/types/types';

type ChatStore = {
  messages: Message[];
  currentChatId: string | null;
  chatHistory: ChatHistory[];
  isLoading: boolean;
  needsTitle: boolean;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string, isStreaming?: boolean) => void;
  setCurrentChatId: (id: string | null) => void;
  setChatHistory: (history: ChatHistory[]) => void;
  setIsLoading: (loading: boolean) => void;
  setNeedsTitle: (needs: boolean) => void;
  saveCurrentChat: (title?: string) => void;
  loadChatHistory: () => void;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
  currentChatId: null,
  chatHistory: [],
  isLoading: false,
  needsTitle: false,

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateLastMessage: (content, isStreaming) =>
    set((state) => {
      const newMessages = [...state.messages];
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage) {
        lastMessage.content = content;
        if (isStreaming !== undefined) {
          lastMessage.isStreaming = isStreaming;
        }
      }
      return { messages: newMessages };
    }),

  setCurrentChatId: (id) => set({ currentChatId: id }),
  setChatHistory: (history) => set({ chatHistory: history }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setNeedsTitle: (needs) => set({ needsTitle: needs }),

  saveCurrentChat: (title) => {
    const { currentChatId, messages } = get();
    if (!currentChatId) return;

    try {
      let currentHistory: ChatHistory[] = [];
      const saved = localStorage.getItem('chatHistory');
      if (saved) {
        currentHistory = JSON.parse(saved);
      }

      const currentChatIndex = currentHistory.findIndex(
        (chat) => chat.id === currentChatId,
      );

      if (currentChatIndex !== -1) {
        currentHistory[currentChatIndex].messages = messages;
        if (title) {
          currentHistory[currentChatIndex].title = title;
        }
      } else {
        currentHistory.unshift({
          id: currentChatId,
          title: title || 'New Chat',
          messages: messages,
          createdAt: Date.now(),
        });
      }

      localStorage.setItem('chatHistory', JSON.stringify(currentHistory));
      window.dispatchEvent(new Event('storageChange'));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  },

  loadChatHistory: () => {
    try {
      const savedChats = localStorage.getItem('chatHistory');
      if (savedChats) {
        const parsed = JSON.parse(savedChats);
        const sorted = parsed.sort(
          (a: ChatHistory, b: ChatHistory) => b.createdAt - a.createdAt,
        );
        set({ chatHistory: sorted });
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  },
}));
