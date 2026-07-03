// ============================================
// Shared Types — AI-Powered Knowledge Base
// ============================================

/**
 * Base entity with common fields.
 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * User profile.
 */
export interface User extends BaseEntity {
  email: string;
}

/**
 * User profile from the profiles table.
 */
export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
}

/**
 * Document stored in the knowledge base.
 */
export interface Document extends BaseEntity {
  userId: string;
  title: string;
  content: string;
  tags: string[];
}

/**
 * A chunk of a document with its embedding vector.
 */
export interface DocumentChunk extends BaseEntity {
  documentId: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
}

/**
 * A conversation session.
 */
export interface Conversation extends BaseEntity {
  userId: string;
  title: string;
}

/**
 * A single message within a conversation.
 */
export interface Message extends BaseEntity {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sourceChunkIds?: string[];
}

// ============================================
// API Response Types
// ============================================

/**
 * API response wrapper for consistent error handling.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Paginated response.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// Auth DTOs
// ============================================

/**
 * Sign up request.
 */
export interface SignUpDto {
  email: string;
  password: string;
  fullName?: string;
}

/**
 * Sign in request.
 */
export interface SignInDto {
  email: string;
  password: string;
}

/**
 * Auth response with tokens.
 */
export interface AuthResponseDto {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}

// ============================================
// Document DTOs
// ============================================

/**
 * Create document request DTO.
 */
export interface CreateDocumentDto {
  title: string;
  content: string;
  tags?: string[];
}

/**
 * Update document request DTO.
 */
export interface UpdateDocumentDto {
  title?: string;
  content?: string;
  tags?: string[];
}

// ============================================
// Chat DTOs
// ============================================

/**
 * Chat request DTO.
 */
export interface ChatRequestDto {
  message: string;
  conversationId?: string;
}

/**
 * Chat response DTO.
 */
export interface ChatResponseDto {
  message: Message;
  sourceChunks?: Array<{
    chunkId: string;
    documentId: string;
    documentTitle: string;
    content: string;
    similarity: number;
  }>;
}
