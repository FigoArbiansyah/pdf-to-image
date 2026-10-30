import Image from 'next/image';
import { ShieldCheck, HardDrive, FileText } from 'lucide-react';

export default function Header() {
  return (
    <header className="app-header" role="banner">
      <div className="brand">
        <div className="brand-logo-container">
          <div className="brand-logo">
            <Image
              src="/icon.png"
              alt="DocPressShot Studio Logo"
              width={54}
              height={54}
              priority
              className="brand-logo-img"
            />
          </div>
        </div>
        <div className="brand-text">
          <div className="brand-badge-pill">
            <span className="status-dot-active" aria-hidden="true"></span>
            <span>100% Client-Side Sandbox &bull; Local Memory Only</span>
          </div>
          <div className="brand-title-group">
            <h1 className="brand-title">DocPressShot Studio</h1>
          </div>
          <p className="brand-subtitle">
            Toolkit utilitas PDF &amp; gambar presisi tinggi. Diproses langsung di perangkat Anda tanpa unggah server.
          </p>
        </div>
      </div>
      <div className="header-right">
        <div className="privacy-badge" role="status" title="Semua berkas tetap berada di RAM lokal peramban">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>Privasi Lokal Terisolasi</span>
        </div>
        <div className="speed-badge" title="Mesin WebAssembly & Worker lokal">
          <HardDrive size={14} aria-hidden="true" />
          <span>Zero Server Upload</span>
        </div>
      </div>
    </header>
  );
}
