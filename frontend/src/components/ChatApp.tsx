// ChatApp.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/stores/store';
import ChatMessage from '@/components/ChatMessage';
import Sidebar from '@/components/Sidebar';
import ChatInput from '@/components/ChatInput';
import type { ChatHistory, QueryResponse } from '@/types/types';

export default function ChatApp() {
  const {
    messages,
    currentChatId,
    isLoading,
    needsTitle,
    setMessages,
    addMessage,
    updateLastMessage,
    setCurrentChatId,
    setIsLoading,
    setNeedsTitle,
    saveCurrentChat,
    loadChatHistory,
  } = useChatStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const responsesContainerRef = useRef<HTMLDivElement>(null);

  // Sidebar props로 전달되는 함수들만 useCallback 사용
  const createNewChat = useCallback(() => {
    const newChatId = Date.now().toString();
    const newChat: ChatHistory = {
      id: newChatId,
      title: 'New Chat',
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      createdAt: Date.now(),
    };

    let currentHistory: ChatHistory[] = [];
    try {
      const saved = localStorage.getItem('chatHistory');
      if (saved) currentHistory = JSON.parse(saved);
    } catch (error) {
      console.error('Error parsing chat history:', error);
    }

    const updatedHistory = [newChat, ...currentHistory];
    localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));

    setMessages(newChat.messages);
    setCurrentChatId(newChatId);
    window.dispatchEvent(new Event('storageChange'));

    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [setMessages, setCurrentChatId]);

  const selectChat = useCallback(
    (chat: ChatHistory) => {
      setMessages(chat.messages);
      setCurrentChatId(chat.id);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    },
    [setMessages, setCurrentChatId],
  );

  const deleteChat = useCallback(
    (e: React.MouseEvent, chatId: string) => {
      e.stopPropagation();

      let currentHistory: ChatHistory[] = [];
      try {
        const saved = localStorage.getItem('chatHistory');
        if (saved) currentHistory = JSON.parse(saved);
      } catch (error) {
        console.error('Error parsing chat history:', error);
      }

      const updatedHistory = currentHistory.filter(
        (chat) => chat.id !== chatId,
      );
      localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));

      useChatStore.getState().setChatHistory(updatedHistory);

      if (chatId === currentChatId) {
        if (updatedHistory.length > 0) {
          selectChat(updatedHistory[0]);
        } else {
          createNewChat();
        }
      }

      window.dispatchEvent(new Event('storageChange'));
    },
    [currentChatId, createNewChat, selectChat],
  );

  // ChatInput props로 전달되는 함수들만 useCallback 사용
  const handleSubmit = useCallback(
    async (userMessage: string) => {
      if (isLoading) return;

      const updatedMessages = [
        ...messages,
        { role: 'user' as const, content: userMessage },
      ];
      setMessages(updatedMessages);
      addMessage({ role: 'assistant', content: '', isStreaming: true });

      setIsLoading(true);
      setIsAutoScroll(true);

      if (messages.length === 1 && messages[0].role === 'system') {
        setNeedsTitle(true);
      }

      saveCurrentChat();

      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const chatController = new AbortController();
        const signal = chatController.signal;

        const response = await fetch('http://localhost:8000/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            messages: updatedMessages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          }),
          signal: signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';

        const readStream = async () => {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              setIsLoading(false);
              updateLastMessage(accumulatedContent, false);
              saveCurrentChat();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const jsonStr = line.slice(5).trim();
                  const parsedData = JSON.parse(jsonStr) as QueryResponse;

                  if (parsedData.data === 'Stream finished') {
                    setIsLoading(false);
                    updateLastMessage(accumulatedContent, false);
                    saveCurrentChat();
                  } else {
                    accumulatedContent += parsedData.data;
                    updateLastMessage(accumulatedContent, true);
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }
        };

        readStream().catch((error) => {
          console.error('Stream reading error:', error);
          setIsLoading(false);
          updateLastMessage(
            accumulatedContent + '\n[Error: Connection failed]',
            false,
          );
          saveCurrentChat();
        });

        eventSourceRef.current = {
          close: () => {
            chatController.abort();
          },
        } as unknown as EventSource;
      } catch (error) {
        console.error('Failed to start chat:', error);
        setIsLoading(false);
        updateLastMessage('\n[Error: Connection failed]', false);
        saveCurrentChat();
      }
    },
    [
      isLoading,
      messages,
      setMessages,
      addMessage,
      setIsLoading,
      setIsAutoScroll,
      setNeedsTitle,
      saveCurrentChat,
      updateLastMessage,
    ],
  );

  const handleStop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsLoading(false);

      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.isStreaming) {
        updateLastMessage(lastMessage.content + '\n[생성 중단됨]', false);
        saveCurrentChat();
      }
    }
  }, [messages, setIsLoading, updateLastMessage, saveCurrentChat]);

  // useEffect 내부에서만 사용되는 함수들은 일반 함수로 변경
  const loadInitialChat = () => {
    try {
      const savedChats = localStorage.getItem('chatHistory');
      if (savedChats) {
        const chats: ChatHistory[] = JSON.parse(savedChats);
        if (chats.length > 0) {
          const mostRecentChat = chats.sort(
            (a, b) => b.createdAt - a.createdAt,
          )[0];
          setMessages(mostRecentChat.messages);
          setCurrentChatId(mostRecentChat.id);
          return;
        }
      }
      createNewChat();
    } catch (error) {
      console.error('Failed to load chat history:', error);
      createNewChat();
    }
  };

  const generateChatTitle = async (userMsg: string, aiResponse: string) => {
    try {
      const response = await fetch('http://localhost:8000/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userMsg,
          aiResponse: aiResponse,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      if (data.title) {
        saveCurrentChat(data.title);
      }
    } catch (error) {
      console.error('Failed to generate title:', error);
      const fallbackTitle =
        userMsg.length > 30 ? `${userMsg.substring(0, 30)}...` : userMsg;
      saveCurrentChat(fallbackTitle);
    }
    setNeedsTitle(false);
  };

  const scrollToBottom = () => {
    if (isAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Initialize app
  useEffect(() => {
    loadInitialChat();
    loadChatHistory();

    window.addEventListener('storageChange', loadChatHistory);
    return () => {
      window.removeEventListener('storageChange', loadChatHistory);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isAutoScroll]);

  const handleScroll = () => {
    if (responsesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        responsesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
      setIsAutoScroll(isAtBottom);
    }
  };

  // Title generation
  useEffect(() => {
    if (needsTitle && messages.length >= 3 && !isLoading) {
      const userMsg =
        messages.find((msg) => msg.role === 'user')?.content || '';
      const aiMsg =
        messages.find((msg) => msg.role === 'assistant')?.content || '';
      if (userMsg && aiMsg) {
        generateChatTitle(userMsg, aiMsg);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsTitle, messages, isLoading]);

  // 간단한 필터링은 렌더링 중에 직접 수행
  const visibleMessages = messages.filter((msg) => msg.role !== 'system');

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Menu Button */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <svg
          className="w-6 h-6 text-gray-600 dark:text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={createNewChat}
        onSelectChat={selectChat}
        onDeleteChat={deleteChat}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages Container */}
        <div
          ref={responsesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-8"
        >
          {visibleMessages.length === 0 ? (
            <div className="max-w-4xl mx-auto text-center mt-20">
              <h1 className="text-3xl font-bold mb-4 dark:text-white">
                Welcome to Chat
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Start a conversation with the AI assistant.
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              {visibleMessages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <ChatInput onSubmit={handleSubmit} onStop={handleStop} />
      </div>
    </div>
  );
}
