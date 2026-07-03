'use client';

import { useState } from 'react';

import { AuthProvider } from '../components/AuthProvider';
import { ChatInterface } from '../components/ChatInterface';
import { DocumentManager } from '../components/DocumentManager';

type Tab = 'documents' | 'chat';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  return (
    <AuthProvider>
      {({ user, accessToken, signOut }) => (
        <div className="app-layout">
          <nav className="app-nav">
            <div className="nav-brand">
              <span className="nav-logo">🧠</span>
              <span className="nav-title">Knowledge Base</span>
            </div>

            <div className="nav-tabs">
              <button
                className={`nav-tab ${activeTab === 'chat' ? 'nav-tab-active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                💬 Chat
              </button>
              <button
                className={`nav-tab ${activeTab === 'documents' ? 'nav-tab-active' : ''}`}
                onClick={() => setActiveTab('documents')}
              >
                📄 Documents
              </button>
            </div>

            <div className="nav-user">
              <span className="nav-user-email">{user?.email}</span>
              <button className="btn-ghost" onClick={signOut}>
                Sign Out
              </button>
            </div>
          </nav>

          <main className="app-main">
            {activeTab === 'chat' ? (
              <ChatInterface accessToken={accessToken!} />
            ) : (
              <DocumentManager accessToken={accessToken!} />
            )}
          </main>
        </div>
      )}
    </AuthProvider>
  );
}
