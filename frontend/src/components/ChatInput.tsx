// components/ChatInput.tsx
import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useChatStore } from '@/stores/store';

type ChatInputProps = {
  onSubmit: (message: string) => void;
  onStop: () => void;
};

export default function ChatInput({ onSubmit, onStop }: ChatInputProps) {
  const { isLoading } = useChatStore();
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 168)}px`;
    }
  }, [prompt]);

  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && prompt.trim()) {
        onSubmit(prompt.trim());
        setPrompt('');
      }
    }
  };

  const handleFormSubmit = () => {
    if (!isLoading && prompt.trim()) {
      onSubmit(prompt.trim());
      setPrompt('');
    }
  };

  return (
    <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex gap-2 max-w-4xl mx-auto">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your prompt here... (Press Enter to submit, Shift+Enter for new line)"
          className="flex-1 resize-none px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={1}
        />
        <button
          onClick={isLoading ? onStop : handleFormSubmit}
          disabled={isLoading ? false : !prompt.trim()}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            isLoading
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed'
          }`}
        >
          {isLoading ? 'Stop' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
