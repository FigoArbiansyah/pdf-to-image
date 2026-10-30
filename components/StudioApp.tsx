'use client';

import { useState, useEffect, useRef } from 'react';
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
  Loader2,
  Archive,
  CheckSquare,
  Square,
  Sparkles,
  Info,
} from 'lucide-react';

interface ConvResultItem {
  pageNum: number;
  objectUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
  selected: boolean;
}

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
  const [convQuality, setConvQuality] = useState<number>(92);
  const [isConvProcessing, setIsConvProcessing] = useState(false);
  const [convProgress, setConvProgress] = useState(0);
  const [convResults, setConvResults] = useState<ConvResultItem[]>([]);
  const [isZipExporting, setIsZipExporting] = useState(false);
  const [isDraggingConv, setIsDraggingConv] = useState(false);

  // --- MERGER STATE ---
  const [mergerFiles, setMergerFiles] = useState<File[]>([]);
  const [isMergerProcessing, setIsMergerProcessing] = useState(false);
  const [isDraggingMerger, setIsDraggingMerger] = useState(false);

  // --- SPLITTER STATE ---
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitTotalPages, setSplitTotalPages] = useState<number>(0);
  const [splitAction, setSplitAction] = useState<'extract' | 'delete' | 'zip'>('extract');
  const [splitPagesText, setSplitPagesText] = useState('');
  const [isSplitProcessing, setIsSplitProcessing] = useState(false);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // --- WATERMARK STATE ---
  const [wmFile, setWmFile] = useState<File | null>(null);
  const [wmText, setWmText] = useState('DOKUMEN RAHASIA');
  const [wmColor, setWmColor] = useState('#2563eb');
  const [wmOpacity, setWmOpacity] = useState(35);
  const [wmFontSize, setWmFontSize] = useState(48);
  const [wmRotation, setWmRotation] = useState(-35);
  const [isWmProcessing, setIsWmProcessing] = useState(false);
  const [isDraggingWm, setIsDraggingWm] = useState(false);
  const wmCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- OCR STATE ---
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrProgressText, setOcrProgressText] = useState('');
  const [isDraggingOcr, setIsDraggingOcr] = useState(false);

  // Clean up Object URLs to prevent memory leaks
  const clearConvResults = () => {
    convResults.forEach((item) => {
      URL.revokeObjectURL(item.objectUrl);
    });
    setConvResults([]);
  };

  useEffect(() => {
    return () => {
      convResults.forEach((item) => URL.revokeObjectURL(item.objectUrl));
    };
  }, [convResults]);

  // Global Clipboard Paste Support (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (!file) continue;

          if (activeTab === 'converter') {
            clearConvResults();
            setConvFile(file);
            showToast(`Berkas ${file.name} ditempel dari clipboard.`, 'info');
          } else if (activeTab === 'merger') {
            setMergerFiles((prev) => [...prev, file]);
            showToast(`Berkas ${file.name} ditambahkan ke daftar merger.`, 'info');
          } else if (activeTab === 'splitter' && file.type === 'application/pdf') {
            handleSplitFile(file);
            showToast(`Berkas ${file.name} dipilih untuk dipisah.`, 'info');
          } else if (activeTab === 'watermark' && file.type === 'application/pdf') {
            setWmFile(file);
            showToast(`Berkas ${file.name} dipilih untuk watermark.`, 'info');
          } else if (activeTab === 'ocr') {
            setOcrFile(file);
            showToast(`Berkas ${file.name} dipilih untuk OCR.`, 'info');
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab]);

  // Update Splitter Page Count when splitFile changes
  const handleSplitFile = async (file: File) => {
    setSplitFile(file);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const buffer = await file.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      setSplitTotalPages(doc.getPageCount());
      setSplitPagesText(`1-${Math.min(3, doc.getPageCount())}`);
    } catch (err) {
      console.error(err);
      setSplitTotalPages(0);
    }
  };

  // --- CONVERTER HANDLERS ---
  const handleConvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      clearConvResults();
      setConvFile(file);
      showToast(`Berkas ${file.name} siap dikonversi.`, 'info');
    }
  };

  const startConversion = async () => {
    if (!convFile) {
      showToast('Pilih berkas PDF atau gambar terlebih dahulu.', 'error');
      return;
    }
    clearConvResults();
    setIsConvProcessing(true);
    setConvProgress(5);

    try {
      if (convFile.type.startsWith('image/')) {
        // Image to Image recompression / conversion
        const img = new Image();
        const reader = new FileReader();

        reader.onload = () => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const mime = convFormat === 'jpeg' ? 'image/jpeg' : convFormat === 'webp' ? 'image/webp' : 'image/png';
              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    const objectUrl = URL.createObjectURL(blob);
                    setConvResults([
                      {
                        pageNum: 1,
                        objectUrl,
                        sizeBytes: blob.size,
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        selected: true,
                      },
                    ]);
                    setConvProgress(100);
                    setIsConvProcessing(false);
                    showToast('Gambar berhasil diproses!', 'success');
                  }
                },
                mime,
                convQuality / 100
              );
            }
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(convFile);
      } else {
        // PDF conversion using local worker
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const arrayBuffer = await convFile.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        const totalPages = pdfDoc.numPages;
        const results: ConvResultItem[] = [];

        const scale = convDpi / 72;
        const mime = convFormat === 'jpeg' ? 'image/jpeg' : convFormat === 'webp' ? 'image/webp' : 'image/png';

        for (let i = 1; i <= totalPages; i++) {
          setConvProgress(Math.round((i / totalPages) * 92));
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;

            const blob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob(resolve, mime, convQuality / 100);
            });

            if (blob) {
              const objectUrl = URL.createObjectURL(blob);
              results.push({
                pageNum: i,
                objectUrl,
                sizeBytes: blob.size,
                width: Math.round(viewport.width),
                height: Math.round(viewport.height),
                selected: true,
              });
            }
          }
        }

        setConvResults(results);
        setConvProgress(100);
        setIsConvProcessing(false);
        showToast(`Berhasil mengonversi ${results.length} halaman!`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      setIsConvProcessing(false);
      showToast('Gagal memproses berkas PDF.', 'error');
    }
  };

  // Batch ZIP Download
  const downloadBatchZip = async (onlySelected: boolean = true) => {
    const targets = onlySelected ? convResults.filter((r) => r.selected) : convResults;
    if (targets.length === 0) {
      showToast('Pilih minimal satu halaman untuk diunduh.', 'error');
      return;
    }

    setIsZipExporting(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (const item of targets) {
        const response = await fetch(item.objectUrl);
        const blob = await response.blob();
        const ext = convFormat === 'jpeg' ? 'jpg' : convFormat;
        zip.file(`halaman-${String(item.pageNum).padStart(3, '0')}.${ext}`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      const baseName = convFile ? convFile.name.replace(/\.[^/.]+$/, '') : 'dokumen';
      link.download = `${baseName}-${convDpi}dpi.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      setIsZipExporting(false);
      showToast(`Arsip ZIP berisi ${targets.length} halaman siap diunduh!`, 'success');
    } catch (err) {
      console.error(err);
      setIsZipExporting(false);
      showToast('Gagal membuat arsip ZIP.', 'error');
    }
  };

  const toggleSelectAll = (select: boolean) => {
    setConvResults((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const togglePageSelection = (pageNum: number) => {
    setConvResults((prev) =>
      prev.map((item) => (item.pageNum === pageNum ? { ...item, selected: !item.selected } : item))
    );
  };

  // --- MERGER HANDLERS ---
  const handleMergerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const added = Array.from(e.target.files);
      setMergerFiles((prev) => [...prev, ...added]);
      showToast(`${added.length} berkas ditambahkan ke antrean merger.`, 'info');
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
      showToast('Tambahkan minimal 2 berkas untuk digabungkan.', 'error');
      return;
    }
    setIsMergerProcessing(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();

      for (const file of mergerFiles) {
        const buffer = await file.arrayBuffer();
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
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
      link.download = `gabungan-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);

      setIsMergerProcessing(false);
      showToast('Dokumen berhasil digabungkan!', 'success');
    } catch (err: any) {
      console.error(err);
      setIsMergerProcessing(false);
      showToast('Gagal menggabungkan dokumen.', 'error');
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
          zip.file(`halaman-${String(i + 1).padStart(3, '0')}.pdf`, pdfBytes);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `${splitFile.name.replace('.pdf', '')}-halaman-terpisah.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('Seluruh halaman berhasil diekspor ke ZIP!', 'success');
      } else {
        // Parse range input e.g. "1-3, 5, 7-9"
        const parsedIndices = new Set<number>();
        const parts = splitPagesText.split(',').map((s) => s.trim());

        for (const part of parts) {
          if (part.includes('-')) {
            const [startStr, endStr] = part.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (!isNaN(start) && !isNaN(end)) {
              for (let k = Math.min(start, end); k <= Math.max(start, end); k++) {
                if (k >= 1 && k <= totalPages) parsedIndices.add(k - 1);
              }
            }
          } else {
            const pageNum = parseInt(part, 10);
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
              parsedIndices.add(pageNum - 1);
            }
          }
        }

        let targetIndices = Array.from(parsedIndices).sort((a, b) => a - b);
        if (splitAction === 'delete') {
          targetIndices = doc.getPageIndices().filter((idx) => !parsedIndices.has(idx));
        }

        if (targetIndices.length === 0) {
          showToast('Masukkan nomor atau rentang halaman yang valid (contoh: 1-3, 5).', 'error');
          setIsSplitProcessing(false);
          return;
        }

        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(doc, targetIndices);
        copiedPages.forEach((p) => newDoc.addPage(p));
        const pdfBytes = await newDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${splitFile.name.replace('.pdf', '')}-${splitAction}-${Date.now()}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('Dokumen berhasil diproses!', 'success');
      }
      setIsSplitProcessing(false);
    } catch (err: any) {
      console.error(err);
      setIsSplitProcessing(false);
      showToast('Gagal memproses dokumen PDF.', 'error');
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
      const { PDFDocument, rgb, degrees, StandardFonts } = await import('pdf-lib');
      const buffer = await wmFile.arrayBuffer();
      const doc = await PDFDocument.load(buffer);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const pages = doc.getPages();

      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 }
          : { r: 0.15, g: 0.39, b: 0.92 };
      };

      const c = hexToRgb(wmColor);

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(wmText, wmFontSize);
        const textHeight = font.heightAtSize(wmFontSize);

        page.drawText(wmText, {
          x: (width - textWidth) / 2,
          y: (height - textHeight) / 2,
          size: wmFontSize,
          font,
          color: rgb(c.r, c.g, c.b),
          opacity: wmOpacity / 100,
          rotate: degrees(wmRotation),
        });
      });

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${wmFile.name.replace('.pdf', '')}-watermarked.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);

      setIsWmProcessing(false);
      showToast('Watermark berhasil diterapkan ke setiap halaman!', 'success');
    } catch (err: any) {
      console.error(err);
      setIsWmProcessing(false);
      showToast('Gagal menerapkan watermark.', 'error');
    }
  };

  // --- OCR HANDLERS ---
  const startOcr = async () => {
    if (!ocrFile) {
      showToast('Pilih berkas PDF atau gambar terlebih dahulu.', 'error');
      return;
    }
    setIsOcrRunning(true);
    setOcrProgressText('Memulai mesin pengenalan karakter...');
    try {
      let imageTarget: Blob | File = ocrFile;

      // If PDF, render first page to canvas first for Tesseract
      if (ocrFile.type === 'application/pdf' || ocrFile.name.toLowerCase().endsWith('.pdf')) {
        setOcrProgressText('Merasterisasi halaman PDF ke kanvas gambar...');
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const buffer = await ocrFile.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
          if (blob) imageTarget = blob;
        }
      }

      setOcrProgressText('Memuat model OCR (Bahasa Indonesia & Inggris)...');
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('ind+eng');
      setOcrProgressText('Menganalisis teks dokumen...');
      const ret = await worker.recognize(imageTarget);
      setOcrText(ret.data.text);
      await worker.terminate();
      setIsOcrRunning(false);
      showToast('Teks berhasil diekstrak!', 'success');
    } catch (err: any) {
      console.error(err);
      setIsOcrRunning(false);
      showToast('Gagal mengekstrak teks dengan OCR.', 'error');
    }
  };

  const selectedCount = convResults.filter((r) => r.selected).length;
  const totalSizeBytes = convResults.reduce((acc, curr) => acc + (curr.selected ? curr.sizeBytes : 0), 0);

  return (
    <main className="app-main" id="main-content" tabIndex={-1}>
      {/* Toast Notification */}
      {toast && (
        <div className="toast-container" role="status" aria-live="polite">
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Segmented Control Nav Tabs */}
      <nav className="app-nav-tabs" role="tablist" aria-label="Alat Studio">
        <button
          type="button"
          className={`nav-tab ${activeTab === 'converter' ? 'active' : ''}`}
          onClick={() => setActiveTab('converter')}
          role="tab"
          aria-selected={activeTab === 'converter'}
        >
          <FileImage size={17} aria-hidden="true" />
          <span>Konversi Gambar</span>
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'merger' ? 'active' : ''}`}
          onClick={() => setActiveTab('merger')}
          role="tab"
          aria-selected={activeTab === 'merger'}
        >
          <Layers size={17} aria-hidden="true" />
          <span>Gabung PDF</span>
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'splitter' ? 'active' : ''}`}
          onClick={() => setActiveTab('splitter')}
          role="tab"
          aria-selected={activeTab === 'splitter'}
        >
          <Scissors size={17} aria-hidden="true" />
          <span>Pisah PDF</span>
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'watermark' ? 'active' : ''}`}
          onClick={() => setActiveTab('watermark')}
          role="tab"
          aria-selected={activeTab === 'watermark'}
        >
          <Stamp size={17} aria-hidden="true" />
          <span>Watermark</span>
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'ocr' ? 'active' : ''}`}
          onClick={() => setActiveTab('ocr')}
          role="tab"
          aria-selected={activeTab === 'ocr'}
        >
          <FileText size={17} aria-hidden="true" />
          <span>Ekstrak OCR</span>
        </button>
      </nav>

      {/* TAB 1: CONVERTER */}
      {activeTab === 'converter' && (
        <div className="tab-content">
          <section
            className={`card upload-card ${isDraggingConv ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingConv(true);
            }}
            onDragLeave={() => setIsDraggingConv(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingConv(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                clearConvResults();
                setConvFile(e.dataTransfer.files[0]);
                showToast(`Berkas ${e.dataTransfer.files[0].name} siap diproses.`, 'info');
              }
            }}
          >
            <input
              type="file"
              id="pdf-input"
              accept="application/pdf, image/png, image/jpeg, image/webp"
              onChange={handleConvFileSelect}
              hidden
            />
            <label htmlFor="pdf-input" className="upload-content">
              <div className="upload-icon-wrapper">
                <Upload className="upload-icon" size={28} />
              </div>
              <h3>Pilih atau Jatuhkan Berkas PDF / Gambar</h3>
              <p>Mendukung format PDF, PNG, JPG, dan WebP (Bisa tekan Ctrl+V untuk menempel)</p>
              <span className="file-hint">Pemrosesan lokal di RAM peramban &bull; Privasi terjamin</span>
            </label>
          </section>

          {convFile && (
            <div className="file-info-bar">
              <div className="file-details">
                <div className="file-icon-box">
                  <FileImage size={22} />
                </div>
                <div className="file-text">
                  <h4>{convFile.name}</h4>
                  <p>{(convFile.size / 1024 / 1024).toFixed(2)} MB &bull; Siap diekstrak</p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => {
                  clearConvResults();
                  setConvFile(null);
                }}
              >
                <RotateCcw size={14} /> Ganti Berkas
              </button>
            </div>
          )}

          <section className="card settings-panel">
            <h3 className="section-title">
              <FileImage size={18} />
              <span>Konfigurasi Rasterisasi Gambar</span>
            </h3>
            <div className="settings-grid">
              <div className="setting-group">
                <label className="setting-label">Format Gambar Output</label>
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
                      <span className="fmt-desc">{fmt === 'png' ? 'Tanpa Rugi (Lossless)' : fmt === 'jpeg' ? 'Ukuran Ringkas' : 'Modern & Hemat'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <label className="setting-label label-with-value">
                  <span>Resolusi Render (DPI)</span>
                  <span className="val-badge">{convDpi} DPI</span>
                </label>
                <select
                  className="custom-select"
                  value={convDpi}
                  onChange={(e) => setConvDpi(Number(e.target.value))}
                >
                  <option value={72}>72 DPI (Layar / Pratinjau Cepat)</option>
                  <option value={150}>150 DPI (Standar Berimbang)</option>
                  <option value={300}>300 DPI (Kualitas Tinggi - HD)</option>
                  <option value={600}>600 DPI (Ultra HD / Keperluan Cetak)</option>
                </select>
              </div>

              {convFormat !== 'png' && (
                <div className="setting-group setting-group-wide">
                  <label className="setting-label label-with-value">
                    <span>Kompresi Kualitas</span>
                    <span className="val-badge">{convQuality}%</span>
                  </label>
                  <input
                    type="range"
                    className="slider"
                    min="40"
                    max="100"
                    value={convQuality}
                    onChange={(e) => setConvQuality(Number(e.target.value))}
                  />
                </div>
              )}
            </div>

            <div className="action-bar">
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={startConversion}
                disabled={!convFile || isConvProcessing}
              >
                {isConvProcessing ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                {isConvProcessing ? `Merasterisasi ${convProgress}%...` : 'Ekstrak Gambar dari Dokumen'}
              </button>
            </div>
          </section>

          {/* Results Gallery */}
          {convResults.length > 0 && (
            <section className="card results-gallery">
              <div className="results-header">
                <div className="results-title-group">
                  <h3>
                    <span>Halaman Hasil Konversi ({convResults.length})</span>
                    <span className="val-badge font-mono">
                      {selectedCount} Terpilih &bull; {(totalSizeBytes / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </h3>
                  <div className="selection-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => toggleSelectAll(true)}
                    >
                      <CheckSquare size={14} /> Pilih Semua
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => toggleSelectAll(false)}
                    >
                      <Square size={14} /> Batal Pilih
                    </button>
                  </div>
                </div>

                <div className="results-toolbar">
                  <button
                    type="button"
                    className="btn btn-success btn-small"
                    onClick={() => downloadBatchZip(true)}
                    disabled={isZipExporting || selectedCount === 0}
                  >
                    {isZipExporting ? <Loader2 className="animate-spin" size={14} /> : <Archive size={14} />}
                    {isZipExporting ? 'Membuat ZIP...' : `Unduh Semua ZIP (${selectedCount})`}
                  </button>
                </div>
              </div>

              <div className="gallery-grid">
                {convResults.map((item) => (
                  <div key={item.pageNum} className={`page-card ${item.selected ? 'selected' : ''}`}>
                    <div className="card-top-bar">
                      <label className="card-checkbox-label">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => togglePageSelection(item.pageNum)}
                        />
                        <span>Hal {item.pageNum}</span>
                      </label>
                      <span className="badge-dim font-mono">{(item.sizeBytes / 1024).toFixed(0)} KB</span>
                    </div>

                    <div
                      className="card-image-wrap"
                      onClick={() => togglePageSelection(item.pageNum)}
                      title="Klik untuk memilih/batalkan halaman"
                    >
                      <img src={item.objectUrl} alt={`Halaman ${item.pageNum}`} loading="lazy" />
                    </div>

                    <div className="card-bottom-bar">
                      <span className="text-xs text-[var(--text-dim)] font-mono">
                        {item.width}×{item.height}
                      </span>
                      <a
                        href={item.objectUrl}
                        download={`halaman-${String(item.pageNum).padStart(3, '0')}.${convFormat === 'jpeg' ? 'jpg' : convFormat}`}
                        className="btn btn-primary btn-small"
                      >
                        <Download size={13} /> Unduh
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
          <section
            className={`card upload-card ${isDraggingMerger ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingMerger(true);
            }}
            onDragLeave={() => setIsDraggingMerger(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingMerger(false);
              if (e.dataTransfer.files) {
                const added = Array.from(e.dataTransfer.files);
                setMergerFiles((prev) => [...prev, ...added]);
                showToast(`${added.length} berkas ditambahkan ke antrean.`, 'info');
              }
            }}
          >
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
                <Layers className="upload-icon" size={28} />
              </div>
              <h3>Pilih Beberapa Berkas PDF atau Gambar</h3>
              <p>Gabungkan beberapa PDF atau gambar menjadi satu dokumen terpadu</p>
              <span className="file-hint">Urutkan posisi halaman sebelum menggabungkan</span>
            </label>
          </section>

          {mergerFiles.length > 0 && (
            <section className="card">
              <div className="results-header">
                <h3 className="section-title" style={{ margin: 0, padding: 0, border: 'none' }}>
                  <Layers size={18} />
                  <span>Antrean Dokumen ({mergerFiles.length} Berkas)</span>
                </h3>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => setMergerFiles([])}
                >
                  <Trash2 size={14} /> Kosongkan Antrean
                </button>
              </div>

              <div className="merger-file-list" style={{ marginTop: '1rem' }}>
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
                        title="Geser ke atas"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-move"
                        onClick={() => moveMergerFile(idx, 'down')}
                        disabled={idx === mergerFiles.length - 1}
                        title="Geser ke bawah"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-delete-item"
                        onClick={() => removeMergerFile(idx)}
                        title="Hapus dari antrean"
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
                  {isMergerProcessing ? <Loader2 className="animate-spin" size={18} /> : <Layers size={18} />}
                  {isMergerProcessing ? 'Menggabungkan Berkas...' : `Gabungkan Menjadi 1 PDF (${mergerFiles.length} Berkas)`}
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 3: SPLITTER */}
      {activeTab === 'splitter' && (
        <div className="tab-content">
          <section
            className={`card upload-card ${isDraggingSplit ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingSplit(true);
            }}
            onDragLeave={() => setIsDraggingSplit(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingSplit(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleSplitFile(e.dataTransfer.files[0]);
              }
            }}
          >
            <input
              type="file"
              id="split-input"
              accept="application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) handleSplitFile(e.target.files[0]);
              }}
              hidden
            />
            <label htmlFor="split-input" className="upload-content">
              <div className="upload-icon-wrapper">
                <Scissors className="upload-icon" size={28} />
              </div>
              <h3>{splitFile ? splitFile.name : 'Pilih Berkas PDF untuk Dipisahkan'}</h3>
              <p>{splitFile ? `${splitTotalPages} total halaman terdeteksi` : 'Ekstrak rentang halaman, hapus halaman tertentu, atau pisah ke ZIP'}</p>
            </label>
          </section>

          {splitFile && (
            <section className="card">
              <h3 className="section-title">
                <Scissors size={18} />
                <span>Strategi Pemisahan Halaman</span>
              </h3>
              <div className="settings-grid">
                <div className="setting-group">
                  <label className="setting-label">Aksi Pemisahan</label>
                  <select
                    className="custom-select"
                    value={splitAction}
                    onChange={(e) => setSplitAction(e.target.value as any)}
                  >
                    <option value="extract">Ekstrak Halaman Pilihan ke 1 Dokumen Baru</option>
                    <option value="delete">Hapus Halaman Pilihan (Simpan Sisanya)</option>
                    <option value="zip">Pisahkan Setiap Halaman Menjadi File Terpisah (.zip)</option>
                  </select>
                </div>

                {splitAction !== 'zip' && (
                  <div className="setting-group">
                    <label className="setting-label label-with-value">
                      <span>Nomor / Rentang Halaman</span>
                      <span className="val-badge font-mono">Total {splitTotalPages} Hal</span>
                    </label>
                    <input
                      type="text"
                      className="custom-input font-mono"
                      placeholder="Contoh: 1-3, 5, 8-10"
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
                  {isSplitProcessing ? <Loader2 className="animate-spin" size={18} /> : <Scissors size={18} />}
                  {isSplitProcessing ? 'Memproses Dokumen...' : 'Eksekusi Pemisahan PDF'}
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 4: WATERMARK */}
      {activeTab === 'watermark' && (
        <div className="tab-content">
          <section
            className={`card upload-card ${isDraggingWm ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingWm(true);
            }}
            onDragLeave={() => setIsDraggingWm(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingWm(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                setWmFile(e.dataTransfer.files[0]);
              }
            }}
          >
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
                <Stamp className="upload-icon" size={28} />
              </div>
              <h3>{wmFile ? wmFile.name : 'Pilih Dokumen PDF untuk Diberi Cap / Watermark'}</h3>
              <p>Tambahkan teks perlindungan dokumen ke seluruh halaman</p>
            </label>
          </section>

          {wmFile && (
            <section className="card">
              <h3 className="section-title">
                <Stamp size={18} />
                <span>Pengaturan Watermark Presisi</span>
              </h3>
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
                  <label className="setting-label">Warna Teks</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      className="custom-input"
                      style={{ width: '60px', height: '42px', padding: '2px', cursor: 'pointer' }}
                      value={wmColor}
                      onChange={(e) => setWmColor(e.target.value)}
                    />
                    <input
                      type="text"
                      className="custom-input font-mono"
                      value={wmColor}
                      onChange={(e) => setWmColor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="setting-group">
                  <label className="setting-label label-with-value">
                    <span>Transparansi / Opasitas</span>
                    <span className="val-badge">{wmOpacity}%</span>
                  </label>
                  <input
                    type="range"
                    className="slider"
                    min="10"
                    max="90"
                    value={wmOpacity}
                    onChange={(e) => setWmOpacity(Number(e.target.value))}
                  />
                </div>

                <div className="setting-group">
                  <label className="setting-label label-with-value">
                    <span>Ukuran Tipografi</span>
                    <span className="val-badge">{wmFontSize} pt</span>
                  </label>
                  <input
                    type="range"
                    className="slider"
                    min="18"
                    max="96"
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
                  {isWmProcessing ? <Loader2 className="animate-spin" size={18} /> : <Stamp size={18} />}
                  {isWmProcessing ? 'Menerapkan Cap...' : 'Terapkan Watermark ke Semua Halaman'}
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 5: OCR */}
      {activeTab === 'ocr' && (
        <div className="tab-content">
          <section
            className={`card upload-card ${isDraggingOcr ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOcr(true);
            }}
            onDragLeave={() => setIsDraggingOcr(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOcr(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                setOcrFile(e.dataTransfer.files[0]);
              }
            }}
          >
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
                <FileText className="upload-icon" size={28} />
              </div>
              <h3>{ocrFile ? ocrFile.name : 'Pilih Berkas PDF atau Gambar untuk Ekstraksi OCR'}</h3>
              <p>Mengekstrak karakter teks langsung di memori komputer Anda</p>
            </label>
          </section>

          {ocrFile && (
            <section className="card">
              <div className="action-bar" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-large"
                  onClick={startOcr}
                  disabled={isOcrRunning}
                >
                  {isOcrRunning ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                  {isOcrRunning ? ocrProgressText : 'Mulai Ekstraksi Teks (OCR)'}
                </button>
              </div>

              {ocrText && (
                <div className="ocr-result-card">
                  <div className="results-header" style={{ marginBottom: '0.75rem' }}>
                    <h4 className="section-title" style={{ margin: 0, padding: 0, border: 'none' }}>
                      <FileText size={16} />
                      <span>Hasil Teks Terekstrak</span>
                    </h4>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        navigator.clipboard.writeText(ocrText);
                        showToast('Teks berhasil disalin ke clipboard!', 'success');
                      }}
                    >
                      <Copy size={14} /> Salin Teks
                    </button>
                  </div>
                  <textarea
                    className="custom-input ocr-textarea"
                    rows={12}
                    value={ocrText}
                    readOnly
                  ></textarea>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
