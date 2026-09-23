import type { Metadata } from 'next';
import { ColdStartBanner } from '@/components/ColdStartBanner';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dhaka Tesla Pool',
  description: 'Share a seat. Split the fare. Survive Dhaka traffic.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-muted/30">
        <Providers>
          <ColdStartBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
