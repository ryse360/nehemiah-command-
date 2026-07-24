import type { Metadata } from 'next';
import { OrganismLab } from '@/components/organism/organism-lab';

export const metadata: Metadata = {
  title: 'Nehemiah Organism Laboratory',
  robots: {
    index: false,
    follow: false,
  },
};

export default function OrganismLaboratoryPage() {
  return (
    <main
      style={{
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: 'clamp(0.85rem, 2.2vh, 1.75rem) 1.25rem clamp(0.6rem, 1.6vh, 1.25rem)',
        background:
          'radial-gradient(circle at 50% 28%, #fffdf7 0%, #f6f1e8 48%, #eee7dc 100%)',
        color: '#403c34',
      }}
    >
      <header
        style={{
          width: 'min(100%, 720px)',
          margin: '0 auto',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        <p
          style={{
            margin: 0,
            color: '#9a7e42',
            fontSize: '0.66rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          Nehemiah visual laboratory
        </p>
        <h1
          style={{
            margin: '0.25rem 0 0.25rem',
            fontSize: 'clamp(1.15rem, 2.4vh, 1.9rem)',
            fontWeight: 520,
            letterSpacing: '-0.03em',
          }}
        >
          A living intelligence
        </h1>
        <p
          style={{
            maxWidth: '560px',
            margin: '0 auto',
            color: '#6d6659',
            lineHeight: 1.4,
            fontSize: '0.82rem',
          }}
        >
          Isolated state laboratory. The authenticated Founder interface remains
          unchanged until this organism is approved.
        </p>
      </header>

      <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
        <OrganismLab />
      </div>
    </main>
  );
}
