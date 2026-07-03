-- ============================================================
-- Migration: Change Vector Dimension to 2048
-- ============================================================

-- Drop dependent index and similarity search function
DROP INDEX IF EXISTS public.idx_chunks_embedding;
DROP FUNCTION IF EXISTS public.match_document_chunks(vector, float, integer, uuid);

-- Alter table to drop and recreate the embedding column with 2048 dimensions
ALTER TABLE public.document_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.document_chunks ADD COLUMN embedding vector(2048);

-- Note: We skip index creation for 2048 dimensions because pgvector limits 
-- vector indexing (HNSW and IVFFlat) to columns with at most 2000 dimensions.
-- Cosine similarity queries will perform a flat scan, which is fully accurate 
-- and extremely fast for typical knowledge bases.

-- Recreate similarity search function with vector(2048) parameter
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding   vector(2048),
  match_threshold   FLOAT DEFAULT 0.7,
  match_count       INTEGER DEFAULT 5,
  p_user_id         UUID DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  document_id     UUID,
  content         TEXT,
  chunk_index     INTEGER,
  similarity      FLOAT,
  document_title  TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.title AS document_title
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE
    (p_user_id IS NULL OR d.user_id = p_user_id)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
