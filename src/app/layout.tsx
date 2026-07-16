import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/service-worker-register';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'TamFam — Tamworth Christadelphian Church',
    template: '%s · TamFam',
  },
  description: 'Members, meetings and attendance for Tamworth Christadelphian Church.',
  manifest: '/manifest.webmanifest',
  applicationName: 'TamFam',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TamFam',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#701d3a',
  width: 'device-width',
  initialScale: 1,
  // Do not disable zoom — pinch-zoom is required for WCAG 1.4.4 / 1.4.10.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={poppins.variable}>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
