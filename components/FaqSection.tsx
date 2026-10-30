import { HelpCircle, ChevronDown, ShieldCheck, Cpu } from 'lucide-react';

export default function FaqSection() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': 'https://doc-shot.vercel.app/#faq',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Bagaimana sistem keamanan berkas di DocPressShot Studio?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Berkas Anda tidak pernah dikirim ke internet atau server pihak ketiga. Seluruh proses konversi, pemisahan, penggabungan, watermark, dan OCR dijalankan di peramban secara lokal menggunakan WebAssembly dan Canvas API.',
        },
      },
      {
        '@type': 'Question',
        name: 'Apakah ada batasan ukuran berkas atau jumlah halaman?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tidak ada batasan buatan dari server. Kapasitas pemrosesan murni bergantung pada RAM dan kecepatan prosesor perangkat Anda.',
        },
      },
      {
        '@type': 'Question',
        name: 'Bagaimana cara mengunduh banyak halaman sekaligus?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Gunakan tombol Unduh Semua (ZIP) pada panel hasil konversi. Sistem akan mengompres seluruh halaman yang dipilih menjadi satu berkas arsip .zip secara otomatis.',
        },
      },
    ],
  };

  return (
    <section className="card faq-section" aria-label="Pertanyaan Umum (FAQ)">
      <script
        id="faq-jsonld-script"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <h3 className="section-title">
        <HelpCircle size={20} aria-hidden="true" />
        <span>Informasi Teknis &amp; Pertanyaan Umum</span>
      </h3>
      <div className="faq-accordion-list">
        <details className="faq-accordion-item">
          <summary className="faq-summary">
            <span className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400" />
              Apakah berkas saya aman dari kebocoran data?
            </span>
            <ChevronDown size={18} className="accordion-icon" aria-hidden="true" />
          </summary>
          <div className="faq-content">
            <p>
              <strong>Ya, 100% aman.</strong> Kode pemrosesan berjalan sepenuhnya di dalam lingkungan peramban Anda. Tidak ada API backend yang menerima dokumen atau gambar Anda. Anda bahkan dapat memutus sambungan internet (offline) setelah halaman terbuka dan aplikasi tetap berfungsi normal.
            </p>
          </div>
        </details>

        <details className="faq-accordion-item">
          <summary className="faq-summary">
            <span className="flex items-center gap-2">
              <Cpu size={18} className="text-blue-400" />
              Bagaimana jika saya mengonversi dokumen ratusan halaman?
            </span>
            <ChevronDown size={18} className="accordion-icon" aria-hidden="true" />
          </summary>
          <div className="faq-content">
            <p>
              DocPressShot Studio menggunakan manajemen memori berbasis Object URL Blob untuk mencegah tab peramban mogok (*crash*). Jika dokumen sangat besar, kami sarankan memilih resolusi <strong>150 DPI</strong> untuk kecepatan optimal atau <strong>300 DPI</strong> untuk kebutuhan cetak presisi.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
