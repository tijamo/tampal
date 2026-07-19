import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import { InstallPrompt } from '@/components/install-prompt';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Tampal — Tamworth Christadelphian Church',
    template: '%s · Tampal',
  },
  description: 'Members, meetings and attendance for Tamworth Christadelphian Church.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Tampal',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tampal',
  },
  // iOS ignores the manifest's icons for "Add to Home Screen" — it needs its
  // own apple-touch-icon link.
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#701d3a',
  width: 'device-width',
  initialScale: 1,
  // Do not disable zoom — pinch-zoom is required for WCAG 1.4.4 / 1.4.10.
  maximumScale: 5,
  // Lets fixed chrome (the mobile bottom nav) extend into notch/home-indicator
  // safe areas instead of leaving a dead gap, via env(safe-area-inset-*).
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={poppins.variable}>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <InstallPrompt />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
