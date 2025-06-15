// types.ts
export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
};

export type ChatHistory = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

export type QueryResponse = {
  status: string;
  data: string;
};
