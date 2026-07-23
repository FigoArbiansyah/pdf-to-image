import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://doc-shot.vercel.app'),
  title: 'DocPressShot Studio - Toolkit Konversi, Gabung, Pisah PDF & Gambar HD Gratis',
  description:
    'DocPressShot Studio: Aplikasi web instan untuk mengonversi, menggabungkan, memisahkan PDF, menambahkan watermark, dan mengekstrak teks OCR dari dokumen PDF & Gambar secara 100% lokal di browser.',
  keywords: [
    'docpressshot',
    'docpressshot studio',
    'docshot',
    'pdf to image',
    'konversi pdf ke gambar',
    'convert pdf to png',
    'convert pdf to jpg',
    'merge pdf',
    'split pdf',
    'pisah pdf',
    'watermark pdf',
    'ocr pdf',
    'ekstrak teks pdf',
  ],
  authors: [{ name: 'DocPressShot Studio' }],
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://doc-shot.vercel.app/',
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: 'https://doc-shot.vercel.app/',
    siteName: 'DocPressShot Studio',
    title: 'DocPressShot Studio - Toolkit PDF & Gambar HD Multi-Fungsi',
    description:
      'Konversi, gabung, pisahkan PDF, watermark, dan ekstrak teks OCR instan 100% lokal & privasi terjaga di peramban Anda.',
    images: [
      {
        url: 'https://doc-shot.vercel.app/icon.png',
        width: 512,
        height: 512,
        alt: 'DocPressShot Studio Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DocPressShot Studio - Toolkit PDF & Gambar HD',
    description:
      'Konversi, gabung, pisahkan PDF, watermark, dan ekstrak teks OCR instan tanpa unggah ke server.',
    images: ['https://doc-shot.vercel.app/icon.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#070a12',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={plusJakartaSans.variable}>
      <body>
        <a href="#main-content" className="skip-link">
          Lompati ke Konten Utama
        </a>
        <div className="container">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
