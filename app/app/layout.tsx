import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Onest, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/app';
import './globals.css';

const sans = Onest({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'FATRAT',
  description: 'Evidence-based strength training, your way.',
  applicationName: 'FATRAT',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
};

const THEME_BOOTSTRAP = [
  '(function(){',
  '  try {',
  '    var k = "fatrat:theme:v1";',
  '    var t = localStorage.getItem(k);',
  '    if (t !== "light" && t !== "dark") t = "dark";',
  '    document.documentElement.setAttribute("data-theme", t);',
  '  } catch (e) {',
  '    document.documentElement.setAttribute("data-theme", "dark");',
  '  }',
  '})();',
].join('\n');

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg text-ink font-sans antialiased" suppressHydrationWarning>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
