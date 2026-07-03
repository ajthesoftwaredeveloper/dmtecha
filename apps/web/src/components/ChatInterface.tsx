'use client';

import type { ApiResponse, ChatResponseDto, ChatStreamEvent, Conversation } from '@dmtecha/shared-types';
import { useState, useRef, useEffect, useCallback } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props {
  accessToken: string;
}

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sourceChunks?: ChatResponseDto['sourceChunks'];
}

interface ApiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sourceChunks?: ChatResponseDto['sourceChunks'];
}

export function ChatInterface({ accessToken }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [showSources, setShowSources] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user's conversations list
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/chat/conversations`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = (await res.json()) as ApiResponse<Conversation[]>;
      if (data.success && data.data) {
        setConversations(data.data);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [accessToken]);

  // Load conversations list on mount
  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages for a specific conversation
  const selectConversation = async (id: string) => {
    if (loading) return;
    setConversationId(id);
    setMessages([]);
    setShowSources(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat/conversations/${id}/messages`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = (await res.json()) as ApiResponse<ApiMessage[]>;
      if (data.success && data.data) {
        // Format database messages to local UI state messages
        const formatted = data.data.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          sourceChunks: m.sourceChunks || [],
        }));
        setMessages(formatted.filter((m) => m.role === 'user' || m.role === 'assistant'));
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete a conversation
  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat session?')) return;

    try {
      const res = await fetch(`${API_URL}/chat/conversations/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = (await res.json()) as ApiResponse<null>;
      if (data.success) {
        if (conversationId === id) {
          startNewChat();
        }
        await loadConversations();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Send message using SSE streaming
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to UI immediately
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    // Prepare placeholders for assistant streaming response
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', sourceChunks: [] },
    ]);

    try {
      const res = await fetch(`${API_URL}/chat/stream`, {
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

      if (!res.ok || !res.body) {
        throw new Error('Streaming failed to start. Backend API error.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantResponse = '';
      let sources: ChatResponseDto['sourceChunks'] = [];
      let buffer = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          
          // Split buffer by double newline (SSE protocol standard)
          const parts = buffer.split('\n\n');
          // Keep the last chunk (potentially incomplete) in buffer
          buffer = parts.pop() || '';

          for (const part of parts) {
            const line = part.trim();
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;

              try {
                const parsed = JSON.parse(dataStr) as ChatStreamEvent;

                if (parsed.type === 'sources') {
                  sources = parsed.chunks;
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last && last.role === 'assistant') {
                      last.sourceChunks = sources;
                    }
                    return next;
                  });
                } else if (parsed.type === 'content') {
                  assistantResponse += parsed.delta;
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last && last.role === 'assistant') {
                      last.content = assistantResponse;
                    }
                    return next;
                  });
                } else if (parsed.type === 'done') {
                  // Final message object returned from backend
                  setConversationId(parsed.message.conversationId);
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last && last.role === 'assistant') {
                      last.id = parsed.message.id;
                      last.content = parsed.message.content;
                    }
                    return next;
                  });
                  void loadConversations();
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.message);
                }
              } catch (e) {
                console.error('Failed to parse SSE event:', e);
              }
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          last.content = `Error: ${err instanceof Error ? err.message : 'Something went wrong while streaming.'}`;
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset to new conversation state
  const startNewChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setShowSources(null);
  };

  return (
    <div className="chat-layout">
      {/* Sidebar Panel for conversation history */}
      <aside className="chat-sidebar">
        <button className="new-chat-button" onClick={startNewChat} disabled={loading}>
          + New Chat
        </button>
        <div className="conversations-list">
          <h3>Recent Conversations</h3>
          {conversations.length === 0 ? (
            <p className="no-conversations">No past conversations</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${conversationId === conv.id ? 'active' : ''}`}
                onClick={() => selectConversation(conv.id)}
              >
                <span className="conv-title">💬 {conv.title}</span>
                <button
                  className="delete-conv-btn"
                  onClick={(e) => void deleteConversation(e, conv.id)}
                  title="Delete Conversation"
                  disabled={loading}
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat interface */}
      <div className="chat-panel">
        <div className="chat-header">
          <h2>💬 AI Chat Assistant</h2>
          {conversationId && (
            <span className="active-chat-indicator">Active Session: {conversationId.slice(0, 8)}...</span>
          )}
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-icon">🧠</div>
              <h3>Ask anything about your knowledge base</h3>
              <p>
                Your AI assistant uses RAG (Retrieval-Augmented Generation) to search your uploaded documents and provide answers with direct citations.
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
                          <span className="source-title">📄 {source.documentTitle || 'Untitled Source'}</span>
                          {source.similarity < 1.0 && (
                            <span className="source-score">
                              {Math.round(source.similarity * 100)}% match
                            </span>
                          )}
                        </div>
                        <p className="source-content">{source.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && messages.length > 0 && messages[messages.length - 1]?.content === '' && (
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
    </div>
  );
}
