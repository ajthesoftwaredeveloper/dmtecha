'use client';

import type { Document, CreateDocumentDto, PaginatedResponse } from '@dmtecha/shared-types';
import { useState, useCallback, useEffect } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props {
  accessToken: string;
}

async function apiFetch<T>(endpoint: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  const data = (await res.json()) as { success: boolean; data: T; error?: { message: string } };
  if (!data.success) throw new Error(data.error?.message ?? 'Request failed');
  return data.data;
}

export function DocumentManager({ accessToken }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiFetch<PaginatedResponse<Document>>('/documents', accessToken);
      setDocuments(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const dto: CreateDocumentDto = {
        title,
        content,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      };

      if (editingDoc) {
        await apiFetch(`/documents/${editingDoc.id}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(dto),
        });
      } else {
        await apiFetch('/documents', accessToken, {
          method: 'POST',
          body: JSON.stringify(dto),
        });
      }

      setTitle('');
      setContent('');
      setTags('');
      setShowForm(false);
      setEditingDoc(null);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleEdit = (doc: Document) => {
    setEditingDoc(doc);
    setTitle(doc.title);
    setContent(doc.content);
    setTags(doc.tags.join(', '));
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await apiFetch(`/documents/${id}`, accessToken, { method: 'DELETE' });
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="documents-panel">
      <div className="documents-header">
        <h2>📄 Documents</h2>
        <button
          className="btn-primary"
          onClick={() => { setShowForm(!showForm); setEditingDoc(null); setTitle(''); setContent(''); setTags(''); }}
        >
          {showForm ? '✕ Cancel' : '+ New Document'}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="document-form">
          <input
            type="text"
            placeholder="Document title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
            required
          />
          <textarea
            placeholder="Document content..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="form-textarea"
            rows={8}
            required
          />
          <input
            type="text"
            placeholder="Tags (comma-separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="form-input"
          />
          <button type="submit" className="btn-primary">
            {editingDoc ? '💾 Update' : '➕ Create'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="loading-state">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <p>No documents yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="documents-list">
          {documents.map((doc) => (
            <div key={doc.id} className="document-card">
              <div className="document-card-header">
                <h3>{doc.title}</h3>
                <div className="document-actions">
                  <button onClick={() => handleEdit(doc)} className="btn-ghost" title="Edit">✏️</button>
                  <button onClick={() => void handleDelete(doc.id)} className="btn-ghost btn-danger" title="Delete">🗑️</button>
                </div>
              </div>
              <p className="document-content-preview">
                {doc.content.length > 200 ? doc.content.slice(0, 200) + '...' : doc.content}
              </p>
              {doc.tags.length > 0 && (
                <div className="document-tags">
                  {doc.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}
              <time className="document-date">
                {new Date(doc.updatedAt).toLocaleDateString()}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
