'use client';

import type { ChatResponseDto } from '@dmtecha/shared-types';
import { useState, useRef, useEffect } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props {
  accessToken: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sourceChunks?: ChatResponseDto['sourceChunks'];
}

export function ChatInterface({ accessToken }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [showSources, setShowSources] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        data: ChatResponseDto;
        error?: { message: string };
      };

      if (!data.success) {
        throw new Error(data.error?.message ?? 'Chat request failed');
      }

      setConversationId(data.data.message.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.data.message.content,
          sourceChunks: data.data.sourceChunks,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setShowSources(null);
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>💬 AI Chat</h2>
        <button className="btn-ghost" onClick={startNewChat}>
          + New Chat
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">🧠</div>
            <h3>Ask anything about your documents</h3>
            <p>
              Your AI assistant uses RAG to search your knowledge base and provide informed answers
              with source citations.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-message chat-message-${msg.role}`}>
            <div className="chat-message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
            <div className="chat-message-content">
              <div className="chat-message-text">{msg.content}</div>
              {msg.sourceChunks && msg.sourceChunks.length > 0 && (
                <button
                  className="sources-toggle"
                  onClick={() => setShowSources(showSources === i ? null : i)}
                >
                  📎 {msg.sourceChunks.length} source{msg.sourceChunks.length !== 1 ? 's' : ''} used
                </button>
              )}
              {showSources === i && msg.sourceChunks && (
                <div className="sources-panel">
                  {msg.sourceChunks.map((source, j) => (
                    <div key={j} className="source-card">
                      <div className="source-header">
                        <span className="source-title">📄 {source.documentTitle}</span>
                        <span className="source-score">
                          {Math.round(source.similarity * 100)}% match
                        </span>
                      </div>
                      <p className="source-content">{source.content.slice(0, 200)}...</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-message-avatar">🤖</div>
            <div className="chat-message-content">
              <div className="chat-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your documents..."
          className="chat-input"
          disabled={loading}
        />
        <button type="submit" className="chat-send-button" disabled={loading || !input.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}
