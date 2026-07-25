import type { Metadata } from 'next';
import './globals.css';
// Additive Tailwind-v4 utility layer (no Preflight) for shadcn/ui primitives.
// Imported AFTER globals.css; contributes utilities only, resets nothing.
import './tailwind.css';

export const metadata: Metadata = {
  title: 'Nehemiah Command',
  description: "The Founder's Private Intelligence",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
