export default function HomePage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1.5rem',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
        }}
      >
        🧠
      </div>
      <h1
        style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Knowledge Base
      </h1>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '1.125rem',
          maxWidth: '480px',
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        AI-Powered Document Intelligence with RAG
      </p>
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          marginTop: '0.5rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {['Next.js', 'NestJS', 'Supabase', 'pgvector', 'OpenAI'].map((tech) => (
          <span
            key={tech}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: '9999px',
              border: '1px solid var(--border)',
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              background: 'var(--surface)',
            }}
          >
            {tech}
          </span>
        ))}
      </div>
      <p
        style={{
          marginTop: '2rem',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          fontSize: '0.875rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--success)',
        }}
      >
        ✓ Monorepo operational — Milestone 1 complete
      </p>
    </main>
  );
}
