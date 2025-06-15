// components/Sidebar.tsx
import React, { useState, useCallback } from 'react';
import { useChatStore } from '@/stores/store';
import type { ChatHistory } from '@/types/types';

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (chat: ChatHistory) => void;
  onDeleteChat: (e: React.MouseEvent, chatId: string) => void;
};

export default function Sidebar({
  isOpen,
  onClose,
  onNewChat,
  onSelectChat,
  onDeleteChat,
}: SidebarProps) {
  const { currentChatId, chatHistory } = useChatStore();
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    const daysDiff = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysDiff < 7) {
      return (
        date.toLocaleDateString([], { weekday: 'short' }) +
        ' ' +
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    }

    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined,
    });
  };

  // 이 함수는 복잡하고 localStorage 작업을 포함하므로 useCallback 적용
  const saveEditedTitle = useCallback(
    (chatId: string) => {
      if (!editedTitle.trim()) return;

      try {
        let currentHistory: ChatHistory[] = [];
        const saved = localStorage.getItem('chatHistory');
        if (saved) {
          currentHistory = JSON.parse(saved);
        }

        const chatIndex = currentHistory.findIndex(
          (chat) => chat.id === chatId,
        );
        if (chatIndex !== -1) {
          currentHistory[chatIndex].title = editedTitle.trim();
          localStorage.setItem('chatHistory', JSON.stringify(currentHistory));
          useChatStore.getState().setChatHistory(currentHistory);

          if (chatId === currentChatId) {
            useChatStore.getState().saveCurrentChat(editedTitle.trim());
          }

          window.dispatchEvent(new Event('storageChange'));
        }
      } catch (error) {
        console.error('Failed to save edited title:', error);
      }

      setEditingChatId(null);
    },
    [editedTitle, currentChatId],
  );

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-900 shadow-lg z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:relative lg:shadow-none`}
      >
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-white">
            Chat History
          </h2>
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={onClose}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <button
          className="w-full p-4 text-left bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          onClick={onNewChat}
        >
          + New Chat
        </button>

        <div className="overflow-y-auto h-[calc(100vh-120px)]">
          {chatHistory.map((chat) => (
            <div
              key={chat.id}
              className={`p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                currentChatId === chat.id ? 'bg-gray-100 dark:bg-gray-800' : ''
              }`}
              onClick={() => onSelectChat(chat)}
            >
              {editingChatId === chat.id ? (
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveEditedTitle(chat.id);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditingChatId(null);
                      }
                    }}
                    className="flex-1 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                    autoFocus
                  />
                  <button
                    onClick={() => saveEditedTitle(chat.id)}
                    className="text-green-600 hover:text-green-700"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setEditingChatId(null)}
                    className="text-red-600 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium dark:text-white truncate flex-1">
                      {chat.title}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingChatId(chat.id);
                          setEditedTitle(chat.title);
                        }}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => onDeleteChat(e, chat.id)}
                        className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(chat.createdAt)}
                  </span>
                </>
              )}
            </div>
          ))}
          {chatHistory.length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No chat history
            </div>
          )}
        </div>
      </div>
    </>
  );
}
