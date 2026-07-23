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
        minHeight: '100vh',
        padding: 'clamp(2rem, 5vw, 4.5rem) 1.25rem 3rem',
        background:
          'radial-gradient(circle at 50% 28%, #fffdf7 0%, #f6f1e8 48%, #eee7dc 100%)',
        color: '#403c34',
      }}
    >
      <header
        style={{
          width: 'min(100%, 840px)',
          margin: '0 auto 1rem',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            color: '#9a7e42',
            fontSize: '0.72rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          Nehemiah visual laboratory
        </p>
        <h1
          style={{
            margin: '0.5rem 0 0.45rem',
            fontSize: 'clamp(2rem, 4vw, 3.5rem)',
            fontWeight: 520,
            letterSpacing: '-0.045em',
          }}
        >
          A living intelligence
        </h1>
        <p
          style={{
            maxWidth: '650px',
            margin: '0 auto',
            color: '#6d6659',
            lineHeight: 1.6,
          }}
        >
          Isolated state laboratory. The authenticated Founder interface remains
          unchanged until this organism is approved.
        </p>
      </header>

      <OrganismLab />
    </main>
  );
}
