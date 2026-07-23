import Image from 'next/image';
import { ShieldCheck, Zap, Wand2 } from 'lucide-react';

export default function Header() {
  return (
    <header className="app-header" role="banner">
      <div className="brand">
        <div className="brand-logo-container">
          <div className="brand-logo">
            <Image
              src="/icon.png"
              alt="DocPressShot Studio Logo"
              width={58}
              height={58}
              priority
              className="brand-logo-img"
            />
          </div>
          <span className="logo-glow-effect"></span>
        </div>
        <div className="brand-text">
          <div className="brand-badge-pill">
            <span className="pulse-dot-indigo" aria-hidden="true"></span>
            <span>WebAssembly Engine &bull; 100% Client-Side Privacy</span>
          </div>
          <div className="brand-title-group">
            <h1 className="brand-title">
              Doc<span className="highlight-press">Press</span>Shot
            </h1>
            <span className="brand-tag">
              <Wand2 size={12} aria-hidden="true" /> Studio
            </span>
          </div>
          <p className="brand-subtitle">
            Toolkit Pemrosesan PDF &amp; Gambar HD Instan Tanpa Server.
          </p>
        </div>
      </div>
      <div className="header-right">
        <div className="privacy-badge" role="status">
          <span className="pulse-dot" aria-hidden="true"></span>
          <ShieldCheck size={16} aria-hidden="true" />
          <span>100% Offline &amp; Privasi</span>
        </div>
        <div className="speed-badge">
          <Zap size={14} aria-hidden="true" />
          <span>Proses Lokal</span>
        </div>
      </div>
    </header>
  );
}
