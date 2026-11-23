import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SECOND BRAIN — Personal Knowledge Operating System',
  description: 'Capture once. Organize intelligently. Retrieve when needed. Intelligent, modular personal knowledge base.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="min-h-full flex flex-col font-sans bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
