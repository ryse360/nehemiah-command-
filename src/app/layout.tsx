import type { Metadata } from 'next';
import './globals.css';

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
