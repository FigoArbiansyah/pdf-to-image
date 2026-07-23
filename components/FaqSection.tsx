export default function FaqSection() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': 'https://doc-shot.vercel.app/#faq',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Apakah dokumen PDF & gambar saya aman?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '100% Aman dan terjamin. Semua proses konversi, penggabungan, pemisahan, watermark, dan OCR diproses sepenuhnya di dalam peramban Anda secara lokal menggunakan memori perangkat tanpa pernah diunggah ke server.',
        },
      },
      {
        '@type': 'Question',
        name: 'Fitur apa saja yang tersedia di DocPressShot Studio?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'DocPressShot Studio menyediakan 5 alat utama: Konversi PDF/Gambar ke PNG/JPG/WEBP, Gabung PDF (Merger), Pisah & Hapus Halaman PDF (Splitter), Watermark PDF, dan Ekstraksi Teks OCR lokal.',
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
        <i className="fa-solid fa-circle-question" aria-hidden="true"></i> Pertanyaan Umum (FAQ)
      </h3>
      <div className="faq-accordion-list">
        <details className="faq-accordion-item">
          <summary className="faq-summary">
            <span>Apakah dokumen PDF &amp; gambar saya aman?</span>
            <i className="fa-solid fa-chevron-down accordion-icon" aria-hidden="true"></i>
          </summary>
          <div className="faq-content">
            <p>
              <strong>100% Aman dan terjamin.</strong> Semua proses konversi, penggabungan, pemisahan, watermark, dan OCR diproses sepenuhnya di dalam peramban Anda secara lokal menggunakan memori perangkat tanpa pernah diunggah ke server.
            </p>
          </div>
        </details>
        <details className="faq-accordion-item">
          <summary className="faq-summary">
            <span>Fitur apa saja yang tersedia di DocPressShot Studio?</span>
            <i className="fa-solid fa-chevron-down accordion-icon" aria-hidden="true"></i>
          </summary>
          <div className="faq-content">
            <p>
              DocPressShot Studio menyediakan 5 alat utama: <strong>Konversi PDF/Gambar</strong> ke PNG/JPG/WEBP, <strong>Gabung PDF</strong> (Merger), <strong>Pisah &amp; Hapus Halaman PDF</strong> (Splitter), <strong>Watermark PDF</strong>, dan <strong>Ekstraksi Teks (OCR)</strong> lokal.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
