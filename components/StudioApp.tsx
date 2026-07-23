'use client';

import { useState } from 'react';
import {
  FileImage,
  Layers,
  Scissors,
  Stamp,
  FileText,
  Upload,
  Play,
  RotateCcw,
  Download,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Loader2,
} from 'lucide-react';

export default function StudioApp() {
  const [activeTab, setActiveTab] = useState<'converter' | 'merger' | 'splitter' | 'watermark' | 'ocr'>('converter');
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  // Helper Toast
  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // --- CONVERTER STATE ---
  const [convFile, setConvFile] = useState<File | null>(null);
  const [convFormat, setConvFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [convDpi, setConvDpi] = useState<number>(300);
  const [convQuality, setConvQuality] = useState<number>(90);
  const [isConvProcessing, setIsConvProcessing] = useState(false);
  const [convProgress, setConvProgress] = useState(0);
  const [convResults, setConvResults] = useState<Array<{ pageNum: number; dataUrl: string }>>([]);

  // --- MERGER STATE ---
  const [mergerFiles, setMergerFiles] = useState<File[]>([]);
  const [isMergerProcessing, setIsMergerProcessing] = useState(false);

  // --- SPLITTER STATE ---
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitAction, setSplitAction] = useState<'extract' | 'delete' | 'zip'>('extract');
  const [splitPagesText, setSplitPagesText] = useState('');
  const [isSplitProcessing, setIsSplitProcessing] = useState(false);

  // --- WATERMARK STATE ---
  const [wmFile, setWmFile] = useState<File | null>(null);
  const [wmText, setWmText] = useState('CONFIDENTIAL');
  const [wmColor, setWmColor] = useState('#ff0000');
  const [wmOpacity, setWmOpacity] = useState(30);
  const [wmFontSize, setWmFontSize] = useState(48);
  const [wmRotation, setWmRotation] = useState(-45);
  const [isWmProcessing, setIsWmProcessing] = useState(false);

  // --- OCR STATE ---
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrProgressText, setOcrProgressText] = useState('');

  // --- CONVERTER HANDLERS ---
  const handleConvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setConvFile(file);
      setConvResults([]);
      showToast(`Berkas ${file.name} berhasil dimuat.`, 'info');
    }
  };

  const startConversion = async () => {
    if (!convFile) {
      showToast('Pilih berkas PDF atau gambar terlebih dahulu.', 'error');
      return;
    }
    setIsConvProcessing(true);
    setConvProgress(10);
    try {
      if (convFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          setConvResults([{ pageNum: 1, dataUrl }]);
          setConvProgress(100);
          setIsConvProcessing(false);
          showToast('Gambar berhasil diproses!', 'success');
        };
        reader.readAsDataURL(convFile);
      } else {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const arrayBuffer = await convFile.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        const totalPages = pdfDoc.numPages;
        const results: Array<{ pageNum: number; dataUrl: string }> = [];

        const scale = convDpi / 72;

        for (let i = 1; i <= totalPages; i++) {
          setConvProgress(Math.round((i / totalPages) * 90));
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            const mime = convFormat === 'jpeg' ? 'image/jpeg' : convFormat === 'webp' ? 'image/webp' : 'image/png';
            const dataUrl = canvas.toDataURL(mime, convQuality / 100);
            results.push({ pageNum: i, dataUrl });
          }
        }
        setConvResults(results);
        setConvProgress(100);
        setIsConvProcessing(false);
        showToast(`Berhasil mengonversi ${totalPages} halaman PDF!`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      setIsConvProcessing(false);
      showToast('Gagal memproses berkas PDF.', 'error');
    }
  };

  // --- MERGER HANDLERS ---
  const handleMergerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const added = Array.from(e.target.files);
      setMergerFiles((prev) => [...prev, ...added]);
      showToast(`${added.length} berkas ditambahkan ke daftar merger.`, 'info');
    }
  };

  const moveMergerFile = (index: number, direction: 'up' | 'down') => {
    const updated = [...mergerFiles];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx >= 0 && targetIdx < updated.length) {
      const temp = updated[index];
      updated[index] = updated[targetIdx];
      updated[targetIdx] = temp;
      setMergerFiles(updated);
    }
  };

  const removeMergerFile = (index: number) => {
    setMergerFiles(mergerFiles.filter((_, i) => i !== index));
  };

  const startMerger = async () => {
    if (mergerFiles.length < 2) {
      showToast('Minimal tambahkan 2 berkas untuk digabungkan.', 'error');
      return;
    }
    setIsMergerProcessing(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();

      for (const file of mergerFiles) {
        const buffer = await file.arrayBuffer();
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const doc = await PDFDocument.load(buffer);
          const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
          copiedPages.forEach((p) => mergedPdf.addPage(p));
        } else if (file.type.startsWith('image/')) {
          let img;
          if (file.type === 'image/png') {
            img = await mergedPdf.embedPng(buffer);
          } else {
            img = await mergedPdf.embedJpg(buffer);
          }
          const page = mergedPdf.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `docpressshot-merged-${Date.now()}.pdf`;
      link.click();
      setIsMergerProcessing(false);
      showToast('Dokumen PDF berhasil digabungkan!', 'success');
    } catch (err: any) {
      console.error(err);
      setIsMergerProcessing(false);
      showToast('Gagal menggabungkan berkas dokumen.', 'error');
    }
  };

  // --- SPLITTER HANDLERS ---
  const startSplitter = async () => {
    if (!splitFile) {
      showToast('Pilih berkas PDF terlebih dahulu.', 'error');
      return;
    }
    setIsSplitProcessing(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const buffer = await splitFile.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      const totalPages = doc.getPageCount();

      if (splitAction === 'zip') {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        for (let i = 0; i < totalPages; i++) {
          const newDoc = await PDFDocument.create();
          const [page] = await newDoc.copyPages(doc, [i]);
          newDoc.addPage(page);
          const pdfBytes = await newDoc.save();
          zip.file(`halaman-${i + 1}.pdf`, pdfBytes);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `${splitFile.name.replace('.pdf', '')}-halaman-terpisah.zip`;
        link.click();
        showToast('Semua halaman berhasil dipisah ke dalam file ZIP!', 'success');
      } else {
        const pagesToExtract = splitPagesText
          .split(',')
          .map((p) => parseInt(p.trim()) - 1)
          .filter((p) => !isNaN(p) && p >= 0 && p < totalPages);

        if (pagesToExtract.length === 0) {
          showToast('Masukkan nomor halaman yang valid.', 'error');
          setIsSplitProcessing(false);
          return;
        }

        const newDoc = await PDFDocument.create();
        let targetIndices = pagesToExtract;
        if (splitAction === 'delete') {
          targetIndices = doc.getPageIndices().filter((idx) => !pagesToExtract.includes(idx));
        }

        const copiedPages = await newDoc.copyPages(doc, targetIndices);
        copiedPages.forEach((p) => newDoc.addPage(p));
        const pdfBytes = await newDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `docpressshot-split-${Date.now()}.pdf`;
        link.click();
        showToast('Dokumen PDF berhasil diproses!', 'success');
      }
      setIsSplitProcessing(false);
    } catch (err: any) {
      console.error(err);
      setIsSplitProcessing(false);
      showToast('Gagal memisah dokumen PDF.', 'error');
    }
  };

  // --- WATERMARK HANDLERS ---
  const startWatermark = async () => {
    if (!wmFile) {
      showToast('Pilih berkas PDF terlebih dahulu.', 'error');
      return;
    }
    setIsWmProcessing(true);
    try {
      const { PDFDocument, rgb, degrees } = await import('pdf-lib');
      const buffer = await wmFile.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      const pages = doc.getPages();

      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 }
          : { r: 1, g: 0, b: 0 };
      };

      const c = hexToRgb(wmColor);

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        page.drawText(wmText, {
          x: width / 4,
          y: height / 2,
          size: wmFontSize,
          color: rgb(c.r, c.g, c.b),
          opacity: wmOpacity / 100,
          rotate: degrees(wmRotation),
        });
      });

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `docpressshot-watermarked-${Date.now()}.pdf`;
      link.click();
      setIsWmProcessing(false);
      showToast('Watermark berhasil ditambahkan ke PDF!', 'success');
    } catch (err: any) {
      console.error(err);
      setIsWmProcessing(false);
      showToast('Gagal menambahkan watermark.', 'error');
    }
  };

  // --- OCR HANDLERS ---
  const startOcr = async () => {
    if (!ocrFile) {
      showToast('Pilih berkas PDF atau gambar terlebih dahulu.', 'error');
      return;
    }
    setIsOcrRunning(true);
    setOcrProgressText('Menyiapkan mesin OCR...');
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('ind+eng');
      setOcrProgressText('Mengekstrak teks dari dokumen...');
      const ret = await worker.recognize(ocrFile);
      setOcrText(ret.data.text);
      await worker.terminate();
      setIsOcrRunning(false);
      showToast('Teks berhasil diekstrak dengan OCR!', 'success');
    } catch (err: any) {
      console.error(err);
      setIsOcrRunning(false);
      showToast('Gagal mengekstrak teks dengan OCR.', 'error');
    }
  };

  return (
    <main className="app-main" id="main-content" tabIndex={-1}>
      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Segmented Control Nav Tabs */}
      <nav className="app-nav-tabs" role="tablist" aria-label="Mode Aplikasi">
        <button
          type="button"
          className={`nav-tab ${activeTab === 'converter' ? 'active' : ''}`}
          onClick={() => setActiveTab('converter')}
          role="tab"
          aria-selected={activeTab === 'converter'}
        >
          <FileImage size={18} aria-hidden="true" /> Konversi Gambar
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'merger' ? 'active' : ''}`}
          onClick={() => setActiveTab('merger')}
          role="tab"
          aria-selected={activeTab === 'merger'}
        >
          <Layers size={18} aria-hidden="true" /> Gabung PDF
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'splitter' ? 'active' : ''}`}
          onClick={() => setActiveTab('splitter')}
          role="tab"
          aria-selected={activeTab === 'splitter'}
        >
          <Scissors size={18} aria-hidden="true" /> Pisah PDF
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'watermark' ? 'active' : ''}`}
          onClick={() => setActiveTab('watermark')}
          role="tab"
          aria-selected={activeTab === 'watermark'}
        >
          <Stamp size={18} aria-hidden="true" /> Watermark PDF
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'ocr' ? 'active' : ''}`}
          onClick={() => setActiveTab('ocr')}
          role="tab"
          aria-selected={activeTab === 'ocr'}
        >
          <FileText size={18} aria-hidden="true" /> Ekstrak Teks (OCR)
        </button>
      </nav>

      {/* TAB 1: CONVERTER */}
      {activeTab === 'converter' && (
        <div className="tab-content">
          <section className="card upload-card">
            <input
              type="file"
              id="pdf-input"
              accept="application/pdf, image/png, image/jpeg, image/webp"
              onChange={handleConvFileSelect}
              hidden
            />
            <label htmlFor="pdf-input" className="upload-content">
              <div className="upload-icon-wrapper">
                <Upload className="upload-icon" size={32} />
              </div>
              <h3>Tarik &amp; Lepaskan File PDF atau Gambar di Sini</h3>
              <p>atau klik untuk memilih berkas dari komputer</p>
              <span className="file-hint">Mendukung: PDF, PNG, JPG, WEBP</span>
            </label>
          </section>

          {convFile && (
            <div className="file-info-bar">
              <div className="file-details">
                <div className="file-icon-box">
                  <FileImage size={24} />
                </div>
                <div className="file-text">
                  <h4>{convFile.name}</h4>
                  <p>{(convFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setConvFile(null)}>
                <RotateCcw size={14} /> Ganti Berkas
              </button>
            </div>
          )}

          <section className="card settings-panel">
            <h3 className="section-title">Pengaturan Hasil Konversi</h3>
            <div className="settings-grid">
              <div className="setting-group">
                <label className="setting-label">Format Output</label>
                <div className="format-toggle">
                  {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
                    <label key={fmt} className="format-btn">
                      <input
                        type="radio"
                        name="fmt"
                        checked={convFormat === fmt}
                        onChange={() => setConvFormat(fmt)}
                      />
                      <span className="fmt-title">{fmt.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <label className="setting-label label-with-value">
                  <span>Resolusi (DPI)</span>
                  <span className="val-badge">{convDpi} DPI</span>
                </label>
                <select
                  className="custom-select"
                  value={convDpi}
                  onChange={(e) => setConvDpi(Number(e.target.value))}
                >
                  <option value={150}>150 DPI (Standar)</option>
                  <option value={300}>300 DPI (Tinggi - HD)</option>
                  <option value={600}>600 DPI (Ultra HD / Cetak)</option>
                </select>
              </div>
            </div>

            <div className="action-bar">
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={startConversion}
                disabled={!convFile || isConvProcessing}
              >
                {isConvProcessing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
                {isConvProcessing ? `Memproses ${convProgress}%` : 'Mulai Konversi Gambar'}
              </button>
            </div>
          </section>

          {/* Results Gallery */}
          {convResults.length > 0 && (
            <section className="card results-gallery">
              <div className="results-header">
                <h3>Hasil Halaman ({convResults.length})</h3>
              </div>
              <div className="gallery-grid">
                {convResults.map((item) => (
                  <div key={item.pageNum} className="page-card">
                    <div className="card-top-bar">
                      <span>Halaman {item.pageNum}</span>
                    </div>
                    <div className="card-image-wrap">
                      <img src={item.dataUrl} alt={`Halaman ${item.pageNum}`} />
                    </div>
                    <div className="card-bottom-bar">
                      <a href={item.dataUrl} download={`halaman-${item.pageNum}.${convFormat}`} className="btn btn-primary btn-small">
                        <Download size={14} /> Unduh
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: MERGER */}
      {activeTab === 'merger' && (
        <div className="tab-content">
          <section className="card upload-card">
            <input
              type="file"
              id="merger-input"
              accept="application/pdf, image/png, image/jpeg, image/webp"
              multiple
              onChange={handleMergerFileSelect}
              hidden
            />
            <label htmlFor="merger-input" className="upload-content">
              <div className="upload-icon-wrapper">
                <Upload className="upload-icon" size={32} />
              </div>
              <h3>Pilih Beberapa Berkas PDF / Gambar untuk Digabungkan</h3>
              <p>Dukungan format: PDF, PNG, JPG, WEBP</p>
            </label>
          </section>

          {mergerFiles.length > 0 && (
            <section className="card">
              <h3 className="section-title">Urutan Berkas Dokumen ({mergerFiles.length})</h3>
              <div className="merger-file-list">
                {mergerFiles.map((file, idx) => (
                  <div key={idx} className="merger-file-item">
                    <div className="merger-item-main">
                      <span className="merger-item-index">{idx + 1}</span>
                      <div className="merger-item-details">
                        <span className="merger-item-name">{file.name}</span>
                        <span className="merger-item-meta">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <div className="merger-item-actions">
                      <button
                        type="button"
                        className="btn-move"
                        onClick={() => moveMergerFile(idx, 'up')}
                        disabled={idx === 0}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-move"
                        onClick={() => moveMergerFile(idx, 'down')}
                        disabled={idx === mergerFiles.length - 1}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-delete-item"
                        onClick={() => removeMergerFile(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="action-bar">
                <button
                  type="button"
                  className="btn btn-primary btn-large"
                  onClick={startMerger}
                  disabled={mergerFiles.length < 2 || isMergerProcessing}
                >
                  {isMergerProcessing ? <Loader2 className="animate-spin" size={20} /> : <Layers size={20} />}
                  {isMergerProcessing ? 'Menggabungkan Dokumen...' : 'Gabungkan Menjadi 1 PDF'}
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 3: SPLITTER */}
      {activeTab === 'splitter' && (
        <div className="tab-content">
          <section className="card upload-card">
            <input
              type="file"
              id="split-input"
              accept="application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) setSplitFile(e.target.files[0]);
              }}
              hidden
            />
            <label htmlFor="split-input" className="upload-content">
              <div className="upload-icon-wrapper">
                <Scissors className="upload-icon" size={32} />
              </div>
              <h3>{splitFile ? splitFile.name : 'Pilih Berkas PDF yang Ingin Dipisah'}</h3>
            </label>
          </section>

          {splitFile && (
            <section className="card">
              <h3 className="section-title">Pengaturan Pemisahan</h3>
              <div className="settings-grid">
                <div className="setting-group">
                  <label className="setting-label">Aksi Pemisahan</label>
                  <select
                    className="custom-select"
                    value={splitAction}
                    onChange={(e) => setSplitAction(e.target.value as any)}
                  >
                    <option value="extract">Ekstrak Halaman Pilihan ke 1 PDF Baru</option>
                    <option value="delete">Hapus Halaman Pilihan dari PDF</option>
                    <option value="zip">Pisahkan Semua Halaman ke ZIP</option>
                  </select>
                </div>
                {splitAction !== 'zip' && (
                  <div className="setting-group">
                    <label className="setting-label">Nomor Halaman (Contoh: 1, 3, 5)</label>
                    <input
                      type="text"
                      className="custom-input"
                      placeholder="Masukkan nomor halaman..."
                      value={splitPagesText}
                      onChange={(e) => setSplitPagesText(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="action-bar">
                <button
                  type="button"
                  className="btn btn-primary btn-large"
                  onClick={startSplitter}
                  disabled={isSplitProcessing}
                >
                  {isSplitProcessing ? <Loader2 className="animate-spin" size={20} /> : <Scissors size={20} />}
                  Proses Pemisahan PDF
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 4: WATERMARK */}
      {activeTab === 'watermark' && (
        <div className="tab-content">
          <section className="card upload-card">
            <input
              type="file"
              id="wm-input"
              accept="application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) setWmFile(e.target.files[0]);
              }}
              hidden
            />
            <label htmlFor="wm-input" className="upload-content">
              <div className="upload-icon-wrapper">
                <Stamp className="upload-icon" size={32} />
              </div>
              <h3>{wmFile ? wmFile.name : 'Pilih Berkas PDF untuk Watermark'}</h3>
            </label>
          </section>

          {wmFile && (
            <section className="card">
              <h3 className="section-title">Pengaturan Watermark</h3>
              <div className="settings-grid">
                <div className="setting-group">
                  <label className="setting-label">Teks Watermark</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={wmText}
                    onChange={(e) => setWmText(e.target.value)}
                  />
                </div>
                <div className="setting-group">
                  <label className="setting-label">Warna Watermark</label>
                  <input
                    type="color"
                    className="custom-input"
                    style={{ height: '44px', padding: '2px' }}
                    value={wmColor}
                    onChange={(e) => setWmColor(e.target.value)}
                  />
                </div>
                <div className="setting-group">
                  <label className="setting-label">Opasitas ({wmOpacity}%)</label>
                  <input
                    type="range"
                    className="slider"
                    min="10"
                    max="100"
                    value={wmOpacity}
                    onChange={(e) => setWmOpacity(Number(e.target.value))}
                  />
                </div>
                <div className="setting-group">
                  <label className="setting-label">Ukuran Font ({wmFontSize}px)</label>
                  <input
                    type="range"
                    className="slider"
                    min="20"
                    max="100"
                    value={wmFontSize}
                    onChange={(e) => setWmFontSize(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="action-bar">
                <button
                  type="button"
                  className="btn btn-primary btn-large"
                  onClick={startWatermark}
                  disabled={isWmProcessing}
                >
                  {isWmProcessing ? <Loader2 className="animate-spin" size={20} /> : <Stamp size={20} />}
                  Terapkan Watermark ke PDF
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 5: OCR */}
      {activeTab === 'ocr' && (
        <div className="tab-content">
          <section className="card upload-card">
            <input
              type="file"
              id="ocr-input"
              accept="application/pdf, image/png, image/jpeg, image/webp"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) setOcrFile(e.target.files[0]);
              }}
              hidden
            />
            <label htmlFor="ocr-input" className="upload-content">
              <div className="upload-icon-wrapper">
                <FileText className="upload-icon" size={32} />
              </div>
              <h3>{ocrFile ? ocrFile.name : 'Pilih Berkas PDF atau Gambar untuk OCR'}</h3>
            </label>
          </section>

          {ocrFile && (
            <section className="card">
              <div className="action-bar">
                <button
                  type="button"
                  className="btn btn-primary btn-large"
                  onClick={startOcr}
                  disabled={isOcrRunning}
                >
                  {isOcrRunning ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                  {isOcrRunning ? ocrProgressText : 'Mulai Ekstraksi Teks (OCR)'}
                </button>
              </div>

              {ocrText && (
                <div className="ocr-result-card">
                  <h4 className="setting-label" style={{ marginBottom: '0.5rem' }}>Teks Hasil Ekstraksi:</h4>
                  <textarea
                    className="custom-input ocr-textarea"
                    rows={10}
                    value={ocrText}
                    readOnly
                  ></textarea>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        navigator.clipboard.writeText(ocrText);
                        showToast('Teks berhasil disalin!', 'success');
                      }}
                    >
                      <Copy size={14} /> Salin Teks
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
