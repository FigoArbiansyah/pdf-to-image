import { inject } from '@vercel/analytics';

// Initialize Vercel Analytics tracking
inject();

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('PWA ServiceWorker registration failed:', err);
    });
  });
}

// Application State
const state = {
  activeTab: 'converter', // 'converter' | 'merger' | 'splitter' | 'watermark' | 'ocr'
  inputMode: 'none',
  pdfFile: null,
  pdfDocument: null,
  imageFiles: [],
  fileNameBase: '',
  totalPages: 0,
  convertedPages: [],
  isConverting: false,
  currentModalIndex: 0,
  modalZoom: 1.0,
  modalRotation: 0,
  galleryFilterQuery: '',

  // Merger State
  mergerFiles: [], // Array of { id, file, name, size, type, pageCount }
  isMerging: false,

  // Splitter State
  splitterFile: null,
  splitterDocument: null,
  splitterTotalPages: 0,
  splitterPages: [], // Array of { pageNum, selected, dataUrl }
  isSplitting: false,

  // Watermark State
  wmFile: null,
  wmDocument: null,
  wmTotalPages: 0,
  isWatermarking: false,

  // OCR State
  ocrFile: null,
  ocrDocument: null,
  ocrExtractedText: '',
  isOcrRunning: false
};

// Lazy Loaded Modules Cache
let pdfjsLibModule = null;
let JSZipModule = null;
let pdfLibModule = null;
let tesseractModule = null;

async function getPdfJs() {
  if (!pdfjsLibModule) {
    const [pdfjs, workerUrl] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.mjs?url')
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default || workerUrl;
    pdfjsLibModule = pdfjs;
  }
  return pdfjsLibModule;
}

async function getJSZip() {
  if (!JSZipModule) {
    const jszipModule = await import('jszip');
    JSZipModule = jszipModule.default || jszipModule;
  }
  return JSZipModule;
}

async function getPdfLib() {
  if (!pdfLibModule) {
    pdfLibModule = await import('pdf-lib');
  }
  return pdfLibModule;
}

async function getTesseract() {
  if (!tesseractModule) {
    tesseractModule = await import('tesseract.js');
  }
  return tesseractModule;
}

// DOM Elements
const elements = {
  // Navigation Tabs
  tabConverter: document.getElementById('tab-converter'),
  tabMerger: document.getElementById('tab-merger'),
  tabSplitter: document.getElementById('tab-splitter'),
  tabWatermark: document.getElementById('tab-watermark'),
  tabOcr: document.getElementById('tab-ocr'),

  converterSection: document.getElementById('converter-section'),
  mergerSection: document.getElementById('merger-section'),
  splitterSection: document.getElementById('splitter-section'),
  watermarkSection: document.getElementById('watermark-section'),
  ocrSection: document.getElementById('ocr-section'),

  // Converter Elements
  dropZone: document.getElementById('drop-zone'),
  pdfInput: document.getElementById('pdf-input'),
  uploadPrompt: document.getElementById('upload-prompt'),
  browseBtn: document.getElementById('browse-btn'),
  fileInfo: document.getElementById('file-info'),
  fileName: document.getElementById('file-name'),
  fileSize: document.getElementById('file-size'),
  filePages: document.getElementById('file-pages'),
  fileTypeIcon: document.getElementById('file-type-icon'),
  changeFileBtn: document.getElementById('change-file-btn'),
  
  settingsPanel: document.getElementById('settings-panel'),
  formatRadios: document.querySelectorAll('input[name="format"]'),
  qualityGroup: document.getElementById('quality-group'),
  qualityLabel: document.getElementById('quality-label'),
  jpgQualitySlider: document.getElementById('jpg-quality'),
  qualityVal: document.getElementById('quality-val'),
  scaleSelect: document.getElementById('scale-select'),
  bgFillSelect: document.getElementById('bg-fill-select'),
  colorModeSelect: document.getElementById('color-mode-select'),
  pageRangeInput: document.getElementById('page-range-input'),
  presetAllBtn: document.getElementById('preset-all-btn'),
  presetFirst5Btn: document.getElementById('preset-first5-btn'),
  presetOddBtn: document.getElementById('preset-odd-btn'),
  presetEvenBtn: document.getElementById('preset-even-btn'),
  convertBtn: document.getElementById('convert-btn'),
  
  progressCard: document.getElementById('progress-card'),
  progressStatus: document.getElementById('progress-status'),
  progressPercent: document.getElementById('progress-percent'),
  progressFill: document.getElementById('progress-fill'),
  
  resultsCard: document.getElementById('results-card'),
  convertedCount: document.getElementById('converted-count'),
  selectAllBtn: document.getElementById('select-all-btn'),
  deselectAllBtn: document.getElementById('deselect-all-btn'),
  downloadZipBtn: document.getElementById('download-zip-btn'),
  zipCount: document.getElementById('zip-count'),
  gallerySearch: document.getElementById('gallery-search'),
  galleryGrid: document.getElementById('gallery-grid'),
  
  // Modal Elements
  previewModal: document.getElementById('preview-modal'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalClose: document.getElementById('modal-close'),
  modalTitle: document.getElementById('modal-title'),
  modalImage: document.getElementById('modal-image'),
  modalViewport: document.getElementById('modal-viewport'),
  modalDownloadLink: document.getElementById('modal-download-link'),
  modalPrevBtn: document.getElementById('modal-prev-btn'),
  modalNextBtn: document.getElementById('modal-next-btn'),
  modalPageNum: document.getElementById('modal-page-num'),

  modalZoomIn: document.getElementById('modal-zoom-in'),
  modalZoomOut: document.getElementById('modal-zoom-out'),
  modalZoomReset: document.getElementById('modal-zoom-reset'),
  modalZoomVal: document.getElementById('modal-zoom-val'),
  modalRotateLeft: document.getElementById('modal-rotate-left'),
  modalRotateRight: document.getElementById('modal-rotate-right'),
  modalCopyBtn: document.getElementById('modal-copy-btn'),
  
  // Merger Elements
  mergerDropZone: document.getElementById('merger-drop-zone'),
  mergerFileInput: document.getElementById('merger-file-input'),
  mergerBrowseBtn: document.getElementById('merger-browse-btn'),
  mergerPanel: document.getElementById('merger-panel'),
  mergerFileCount: document.getElementById('merger-file-count'),
  mergerFileList: document.getElementById('merger-file-list'),
  mergerAddMoreBtn: document.getElementById('merger-add-more-btn'),
  mergerClearAllBtn: document.getElementById('merger-clear-all-btn'),
  mergerPageSize: document.getElementById('merger-page-size'),
  mergerOrientation: document.getElementById('merger-orientation'),
  mergerMargin: document.getElementById('merger-margin'),
  mergerStartBtn: document.getElementById('merger-start-btn'),
  mergerProgressCard: document.getElementById('merger-progress-card'),
  mergerProgressStatus: document.getElementById('merger-progress-status'),
  mergerProgressPercent: document.getElementById('merger-progress-percent'),
  mergerProgressFill: document.getElementById('merger-progress-fill'),

  // Splitter Elements
  splitterDropZone: document.getElementById('splitter-drop-zone'),
  splitterFileInput: document.getElementById('splitter-file-input'),
  splitterBrowseBtn: document.getElementById('splitter-browse-btn'),
  splitterPanel: document.getElementById('splitter-panel'),
  splitterFileName: document.getElementById('splitter-file-name'),
  splitterFileMeta: document.getElementById('splitter-file-meta'),
  splitterChangeBtn: document.getElementById('splitter-change-btn'),
  splitterSelectedCount: document.getElementById('splitter-selected-count'),
  splitterSelectAll: document.getElementById('splitter-select-all'),
  splitterDeselectAll: document.getElementById('splitter-deselect-all'),
  splitterPagesGrid: document.getElementById('splitter-pages-grid'),
  splitterStartBtn: document.getElementById('splitter-start-btn'),
  splitterProgressCard: document.getElementById('splitter-progress-card'),
  splitterProgressStatus: document.getElementById('splitter-progress-status'),
  splitterProgressPercent: document.getElementById('splitter-progress-percent'),
  splitterProgressFill: document.getElementById('splitter-progress-fill'),

  // Watermark Elements
  wmDropZone: document.getElementById('wm-drop-zone'),
  wmFileInput: document.getElementById('wm-file-input'),
  wmBrowseBtn: document.getElementById('wm-browse-btn'),
  wmPanel: document.getElementById('wm-panel'),
  wmFileName: document.getElementById('wm-file-name'),
  wmFileMeta: document.getElementById('wm-file-meta'),
  wmChangeBtn: document.getElementById('wm-change-btn'),
  wmTextInput: document.getElementById('wm-text-input'),
  wmColorSelect: document.getElementById('wm-color-select'),
  wmOpacitySlider: document.getElementById('wm-opacity-slider'),
  wmOpacityVal: document.getElementById('wm-opacity-val'),
  wmSizeSlider: document.getElementById('wm-size-slider'),
  wmSizeVal: document.getElementById('wm-size-val'),
  wmAngleSelect: document.getElementById('wm-angle-select'),
  wmStartBtn: document.getElementById('wm-start-btn'),
  wmProgressCard: document.getElementById('wm-progress-card'),
  wmProgressStatus: document.getElementById('wm-progress-status'),
  wmProgressPercent: document.getElementById('wm-progress-percent'),
  wmProgressFill: document.getElementById('wm-progress-fill'),

  ocrIconBox: document.getElementById('ocr-icon-box'),
  ocrDropZone: document.getElementById('ocr-drop-zone'),
  ocrFileInput: document.getElementById('ocr-file-input'),
  ocrBrowseBtn: document.getElementById('ocr-browse-btn'),
  ocrPanel: document.getElementById('ocr-panel'),
  ocrFileName: document.getElementById('ocr-file-name'),
  ocrFileMeta: document.getElementById('ocr-file-meta'),
  ocrChangeBtn: document.getElementById('ocr-change-btn'),
  ocrStartBtn: document.getElementById('ocr-start-btn'),
  ocrProgressCard: document.getElementById('ocr-progress-card'),
  ocrProgressStatus: document.getElementById('ocr-progress-status'),
  ocrProgressPercent: document.getElementById('ocr-progress-percent'),
  ocrProgressFill: document.getElementById('ocr-progress-fill'),
  ocrResultCard: document.getElementById('ocr-result-card'),
  ocrTextResult: document.getElementById('ocr-text-result'),
  ocrCopyBtn: document.getElementById('ocr-copy-btn'),
  ocrDownloadBtn: document.getElementById('ocr-download-btn'),

  toastContainer: document.getElementById('toast-container')
};

// Initialize App
function init() {
  initTabNavigation();

  // Converter Handlers
  elements.browseBtn.addEventListener('click', () => elements.pdfInput.click());
  elements.pdfInput.addEventListener('change', handleFileSelect);
  
  setupDragDrop(elements.dropZone, (files) => processInputFiles(files));

  elements.changeFileBtn.addEventListener('click', resetFileState);

  elements.formatRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const fmt = e.target.value;
      if (fmt === 'jpg' || fmt === 'webp') {
        elements.qualityGroup.classList.remove('hidden');
        elements.qualityLabel.textContent = `Kualitas ${fmt.toUpperCase()}`;
      } else {
        elements.qualityGroup.classList.add('hidden');
      }
    });
  });

  elements.jpgQualitySlider.addEventListener('input', (e) => {
    elements.qualityVal.textContent = `${e.target.value}%`;
  });

  elements.presetAllBtn.addEventListener('click', () => setPresetFilter('all'));
  if (elements.presetFirst5Btn) {
    elements.presetFirst5Btn.addEventListener('click', () => setPresetFilter('first5'));
  }
  elements.presetOddBtn.addEventListener('click', () => setPresetFilter('odd'));
  elements.presetEvenBtn.addEventListener('click', () => setPresetFilter('even'));
  
  elements.pageRangeInput.addEventListener('input', () => {
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
  });

  elements.convertBtn.addEventListener('click', startConversion);
  elements.selectAllBtn.addEventListener('click', () => toggleAllSelections(true));
  elements.deselectAllBtn.addEventListener('click', () => toggleAllSelections(false));
  elements.downloadZipBtn.addEventListener('click', downloadAsZip);

  if (elements.gallerySearch) {
    elements.gallerySearch.addEventListener('input', (e) => {
      state.galleryFilterQuery = e.target.value.toLowerCase().trim();
      renderGallery();
    });
  }

  // Lightbox Handlers
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalBackdrop.addEventListener('click', closeModal);
  elements.modalPrevBtn.addEventListener('click', showPrevModalImage);
  elements.modalNextBtn.addEventListener('click', showNextModalImage);

  if (elements.modalZoomIn) {
    elements.modalZoomIn.addEventListener('click', () => zoomModal(0.2));
    elements.modalZoomOut.addEventListener('click', () => zoomModal(-0.2));
    elements.modalZoomReset.addEventListener('click', () => resetModalZoom());
    elements.modalRotateLeft.addEventListener('click', () => rotateModalImage(-90));
    elements.modalRotateRight.addEventListener('click', () => rotateModalImage(90));
    elements.modalCopyBtn.addEventListener('click', copyCurrentModalToClipboard);
  }

  // Merger Handlers
  if (elements.mergerBrowseBtn) {
    elements.mergerBrowseBtn.addEventListener('click', () => elements.mergerFileInput.click());
    elements.mergerFileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) processMergerFiles(files);
      e.target.value = '';
    });
    setupDragDrop(elements.mergerDropZone, (files) => processMergerFiles(files));
    elements.mergerAddMoreBtn.addEventListener('click', () => elements.mergerFileInput.click());
    elements.mergerClearAllBtn.addEventListener('click', clearAllMergerFiles);
    elements.mergerStartBtn.addEventListener('click', startMergerProcess);
  }

  // Splitter Handlers
  if (elements.splitterBrowseBtn) {
    elements.splitterBrowseBtn.addEventListener('click', () => elements.splitterFileInput.click());
    elements.splitterFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) loadSplitterPdf(e.target.files[0]);
    });
    setupDragDrop(elements.splitterDropZone, (files) => {
      const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (pdfs.length > 0) loadSplitterPdf(pdfs[0]);
    });
    elements.splitterChangeBtn.addEventListener('click', resetSplitterState);
    elements.splitterSelectAll.addEventListener('click', () => toggleSplitterSelections(true));
    elements.splitterDeselectAll.addEventListener('click', () => toggleSplitterSelections(false));
    elements.splitterStartBtn.addEventListener('click', startSplitterProcess);
  }

  // Watermark Handlers
  if (elements.wmBrowseBtn) {
    elements.wmBrowseBtn.addEventListener('click', () => elements.wmFileInput.click());
    elements.wmFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) loadWmPdf(e.target.files[0]);
    });
    setupDragDrop(elements.wmDropZone, (files) => {
      const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (pdfs.length > 0) loadWmPdf(pdfs[0]);
    });
    elements.wmChangeBtn.addEventListener('click', resetWmState);
    elements.wmOpacitySlider.addEventListener('input', (e) => elements.wmOpacityVal.textContent = `${e.target.value}%`);
    elements.wmSizeSlider.addEventListener('input', (e) => elements.wmSizeVal.textContent = `${e.target.value} px`);
    elements.wmStartBtn.addEventListener('click', startWatermarkProcess);
  }

  // OCR Handlers
  if (elements.ocrBrowseBtn) {
    elements.ocrBrowseBtn.addEventListener('click', () => elements.ocrFileInput.click());
    elements.ocrFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) loadOcrFile(e.target.files[0]);
    });
    setupDragDrop(elements.ocrDropZone, (files) => {
      if (files.length > 0) loadOcrFile(files[0]);
    });
    elements.ocrChangeBtn.addEventListener('click', resetOcrState);
    elements.ocrStartBtn.addEventListener('click', startOcrProcess);
    elements.ocrCopyBtn.addEventListener('click', copyOcrText);
    elements.ocrDownloadBtn.addEventListener('click', downloadOcrTxt);
  }

  document.addEventListener('keydown', handleGlobalKeydown);
}

// Drag and Drop Helper
function setupDragDrop(dropZoneEl, onFilesDropped) {
  if (!dropZoneEl) return;

  ['dragenter', 'dragover'].forEach(name => {
    dropZoneEl.addEventListener(name, (e) => {
      e.preventDefault();
      dropZoneEl.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZoneEl.addEventListener(name, (e) => {
      e.preventDefault();
      dropZoneEl.classList.remove('drag-over');
    });
  });

  dropZoneEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZoneEl.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesDropped(files);
  });
}

// App Mode Navigation Tabs
function initTabNavigation() {
  const tabs = [
    { btn: elements.tabConverter, sec: elements.converterSection, key: 'converter' },
    { btn: elements.tabMerger, sec: elements.mergerSection, key: 'merger' },
    { btn: elements.tabSplitter, sec: elements.splitterSection, key: 'splitter' },
    { btn: elements.tabWatermark, sec: elements.watermarkSection, key: 'watermark' },
    { btn: elements.tabOcr, sec: elements.ocrSection, key: 'ocr' }
  ];

  tabs.forEach(tab => {
    if (tab.btn) {
      tab.btn.addEventListener('click', () => switchTab(tab.key));
    }
  });
}

function switchTab(targetKey) {
  state.activeTab = targetKey;

  const tabs = [
    { btn: elements.tabConverter, sec: elements.converterSection, key: 'converter' },
    { btn: elements.tabMerger, sec: elements.mergerSection, key: 'merger' },
    { btn: elements.tabSplitter, sec: elements.splitterSection, key: 'splitter' },
    { btn: elements.tabWatermark, sec: elements.watermarkSection, key: 'watermark' },
    { btn: elements.tabOcr, sec: elements.ocrSection, key: 'ocr' }
  ];

  tabs.forEach(tab => {
    if (!tab.btn || !tab.sec) return;
    const isActive = tab.key === targetKey;
    tab.btn.classList.toggle('active', isActive);
    tab.btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.sec.classList.toggle('hidden', !isActive);
  });
}

function handleGlobalKeydown(e) {
  if (elements.previewModal.classList.contains('hidden')) return;

  if (e.key === 'Escape') {
    closeModal();
    return;
  }
  if (e.key === 'ArrowLeft') showPrevModalImage();
  if (e.key === 'ArrowRight') showNextModalImage();
  if (e.key === '+' || e.key === '=') zoomModal(0.2);
  if (e.key === '-' || e.key === '_') zoomModal(-0.2);
}

/* ==========================================================================
   1. CONVERTER ROUTINES
   ========================================================================== */

function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  if (files.length > 0) processInputFiles(files);
}

function processInputFiles(files) {
  const emptyFiles = files.filter(f => f.size === 0);
  if (emptyFiles.length > 0) {
    showToast('Terdapat berkas kosong (0 Bytes) yang tidak dapat diproses.', 'error');
    return;
  }

  const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  const imageFiles = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name));

  if (pdfFiles.length > 0) loadPdfFile(pdfFiles[0]);
  else if (imageFiles.length > 0) loadImageFiles(imageFiles);
  else showToast('Mohon pilih berkas berformat PDF atau Gambar valid (PNG/JPG/WEBP).', 'error');
}

function setPresetFilter(type) {
  document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
  if (!state.totalPages) {
    elements.pageRangeInput.value = '';
    return;
  }

  if (type === 'all') {
    elements.presetAllBtn.classList.add('active');
    elements.pageRangeInput.value = '';
  } else if (type === 'first5') {
    if (elements.presetFirst5Btn) elements.presetFirst5Btn.classList.add('active');
    const limit = Math.min(5, state.totalPages);
    elements.pageRangeInput.value = `1-${limit}`;
  } else if (type === 'odd') {
    elements.presetOddBtn.classList.add('active');
    const oddPages = [];
    for (let i = 1; i <= state.totalPages; i += 2) oddPages.push(i);
    elements.pageRangeInput.value = oddPages.join(', ');
  } else if (type === 'even') {
    elements.presetEvenBtn.classList.add('active');
    const evenPages = [];
    for (let i = 2; i <= state.totalPages; i += 2) evenPages.push(i);
    elements.pageRangeInput.value = evenPages.join(', ');
  }
}

async function loadPdfFile(file) {
  resetFileState();
  state.inputMode = 'pdf';
  state.pdfFile = file;
  state.fileNameBase = file.name.replace(/\.pdf$/i, '');
  
  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatBytes(file.size);
  elements.fileTypeIcon.className = 'fa-solid fa-file-pdf';
  elements.uploadPrompt.classList.add('hidden');
  elements.fileInfo.classList.remove('hidden');
  
  try {
    showToast('Membaca dokumen PDF...', 'info');
    const pdfjsLib = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    state.pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    state.totalPages = state.pdfDocument.numPages;
    
    elements.filePages.textContent = `${state.totalPages} Halaman`;
    elements.settingsPanel.classList.remove('disabled');
    setPresetFilter('all');
    showToast(`PDF Berhasil dimuat (${state.totalPages} Halaman)`, 'success');
  } catch (err) {
    console.error('Error loading PDF:', err);
    showToast('Gagal membaca dokumen PDF.', 'error');
    resetFileState();
  }
}

function loadImageFiles(files) {
  resetFileState();
  state.inputMode = 'images';
  state.imageFiles = files;
  state.totalPages = files.length;
  
  const firstFile = files[0];
  state.fileNameBase = firstFile.name.replace(/\.[^/.]+$/, '');
  
  const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);
  elements.fileName.textContent = files.length === 1 ? firstFile.name : `${files.length} Gambar Dimuat`;
  elements.fileSize.textContent = formatBytes(totalSizeBytes);
  elements.filePages.textContent = `${files.length} Item`;
  elements.fileTypeIcon.className = 'fa-solid fa-file-image';
  
  elements.uploadPrompt.classList.add('hidden');
  elements.fileInfo.classList.remove('hidden');
  elements.settingsPanel.classList.remove('disabled');
  
  setPresetFilter('all');
  showToast(`Berhasil memuat ${files.length} gambar.`, 'success');
}

function resetFileState() {
  state.inputMode = 'none';
  state.pdfFile = null;
  state.pdfDocument = null;
  state.imageFiles = [];
  state.fileNameBase = '';
  state.totalPages = 0;
  state.convertedPages = [];
  state.galleryFilterQuery = '';
  if (elements.gallerySearch) elements.gallerySearch.value = '';
  
  elements.pdfInput.value = '';
  elements.fileInfo.classList.add('hidden');
  elements.uploadPrompt.classList.remove('hidden');
  elements.settingsPanel.classList.add('disabled');
  elements.resultsCard.classList.add('hidden');
  elements.progressCard.classList.add('hidden');
  elements.galleryGrid.innerHTML = '';
}

async function startConversion() {
  if (state.inputMode === 'none' || state.isConverting) return;
  
  state.isConverting = true;
  state.convertedPages = [];
  elements.galleryGrid.innerHTML = '';
  elements.resultsCard.classList.add('hidden');
  elements.progressCard.classList.remove('hidden');
  elements.convertBtn.disabled = true;

  elements.progressCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const selectedFormat = document.querySelector('input[name="format"]:checked').value;
  let mimeType = 'image/png';
  if (selectedFormat === 'jpg') mimeType = 'image/jpeg';
  else if (selectedFormat === 'webp') mimeType = 'image/webp';
  
  const quality = parseInt(elements.jpgQualitySlider.value, 10) / 100;
  const scale = parseFloat(elements.scaleSelect.value);
  const bgColor = elements.bgFillSelect ? elements.bgFillSelect.value : 'white';
  const colorMode = elements.colorModeSelect ? elements.colorModeSelect.value : 'color';
  
  const pagesToConvert = parsePageRange(elements.pageRangeInput.value.trim(), state.totalPages);
  
  if (pagesToConvert.length === 0) {
    showToast('Tidak ada item valid dalam rentang yang ditentukan.', 'error');
    finishConversion();
    return;
  }

  const total = pagesToConvert.length;
  updateProgress(0, total, 'Memulai konversi...');

  if (state.inputMode === 'pdf') {
    await convertPdfMode(pagesToConvert, selectedFormat, mimeType, quality, scale, bgColor, colorMode);
  } else if (state.inputMode === 'images') {
    await convertImagesMode(pagesToConvert, selectedFormat, mimeType, quality, scale, bgColor, colorMode);
  }

  updateProgress(total, total, 'Selesai!');
  setTimeout(() => {
    elements.progressCard.classList.add('hidden');
    renderGallery();
    elements.resultsCard.classList.remove('hidden');
    finishConversion();
    
    elements.resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`Berhasil mengonversi ${state.convertedPages.length} berkas!`, 'success');
  }, 300);
}

function yieldToMainThread(ms = 10) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function applyCanvasBg(ctx, width, height, bgColor, selectedFormat) {
  if (bgColor === 'white' || (selectedFormat === 'jpg' && bgColor === 'transparent')) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  } else if (bgColor === 'black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }
}

function applyColorModeFilters(ctx, width, height, colorMode) {
  if (colorMode === 'color') return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (colorMode === 'grayscale') {
        d[i] = gray;
        d[i + 1] = gray;
        d[i + 2] = gray;
      } else if (colorMode === 'monochrome') {
        const val = gray >= 128 ? 255 : 0;
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.warn('Color filter error:', e);
  }
}

async function convertPdfMode(pagesToConvert, selectedFormat, mimeType, quality, scale, bgColor, colorMode) {
  const total = pagesToConvert.length;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  for (let i = 0; i < total; i++) {
    const pageNum = pagesToConvert[i];
    updateProgress(i, total, `Mengonversi halaman ${pageNum} dari ${state.totalPages}...`);
    await yieldToMainThread(10);

    try {
      const page = await state.pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      applyCanvasBg(ctx, canvas.width, canvas.height, bgColor, selectedFormat);

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      applyColorModeFilters(ctx, canvas.width, canvas.height, colorMode);

      const dataUrl = canvas.toDataURL(mimeType, quality);
      const blob = await (await fetch(dataUrl)).blob();
      const outputFileName = `${state.fileNameBase}_page_${pageNum}.${selectedFormat}`;

      state.convertedPages.push({
        pageNum,
        blob,
        dataUrl,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        selected: true,
        fileName: outputFileName
      });
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
      showToast(`Gagal merender halaman ${pageNum}`, 'error');
    }
  }
}

async function convertImagesMode(indicesToConvert, selectedFormat, mimeType, quality, scale, bgColor, colorMode) {
  const total = indicesToConvert.length;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  for (let i = 0; i < total; i++) {
    const itemIndex = indicesToConvert[i] - 1;
    const file = state.imageFiles[itemIndex];
    if (!file) continue;

    updateProgress(i, total, `Mengonversi gambar ${i + 1} dari ${total}...`);
    await yieldToMainThread(10);

    try {
      const img = await loadImageFromFile(file);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      applyCanvasBg(ctx, canvas.width, canvas.height, bgColor, selectedFormat);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      applyColorModeFilters(ctx, canvas.width, canvas.height, colorMode);

      const dataUrl = canvas.toDataURL(mimeType, quality);
      const blob = await (await fetch(dataUrl)).blob();
      
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const outputFileName = `${cleanName}_converted.${selectedFormat}`;

      state.convertedPages.push({
        pageNum: itemIndex + 1,
        blob,
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        selected: true,
        fileName: outputFileName
      });
    } catch (err) {
      console.error(`Error converting image ${file.name}:`, err);
      showToast(`Gagal mengonversi ${file.name}`, 'error');
    }
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function updateProgress(current, total, statusText) {
  const percent = Math.round((current / total) * 100);
  elements.progressFill.style.width = `${percent}%`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${statusText}`;
}

function finishConversion() {
  state.isConverting = false;
  elements.convertBtn.disabled = false;
}

function renderGallery() {
  elements.galleryGrid.innerHTML = '';
  
  const query = state.galleryFilterQuery;
  const filteredPages = state.convertedPages.filter(item => {
    if (!query) return true;
    const matchName = item.fileName.toLowerCase().includes(query);
    const matchNum = item.pageNum.toString().includes(query);
    return matchName || matchNum;
  });

  elements.convertedCount.textContent = filteredPages.length;
  updateZipCount();

  const isPdf = state.inputMode === 'pdf';

  filteredPages.forEach((item) => {
    const index = state.convertedPages.indexOf(item);
    const card = document.createElement('div');
    card.className = `page-card ${item.selected ? 'selected' : ''}`;
    card.dataset.index = index;

    const labelText = isPdf ? `Halaman ${item.pageNum}` : `Item ${item.pageNum}`;

    card.innerHTML = `
      <div class="card-top-bar">
        <label class="card-checkbox-label">
          <input type="checkbox" class="page-checkbox" ${item.selected ? 'checked' : ''} data-index="${index}" />
          <span>${labelText}</span>
        </label>
        <span class="badge-dim">${item.width} x ${item.height} px</span>
      </div>
      <div class="card-image-wrap" data-index="${index}">
        <img src="${item.dataUrl}" alt="${item.fileName}" loading="lazy" />
        <div class="image-overlay">
          <button type="button" class="btn btn-small btn-secondary preview-btn" data-index="${index}">
            <i class="fa-solid fa-magnifying-glass-plus"></i> Perbesar
          </button>
        </div>
      </div>
      <div class="card-bottom-bar">
        <button type="button" class="btn btn-small btn-secondary rotate-card-btn" data-index="${index}" title="Putar 90°">
          <i class="fa-solid fa-rotate-right"></i>
        </button>
        <button type="button" class="btn btn-small btn-secondary copy-card-btn" data-index="${index}" title="Salin ke Clipboard">
          <i class="fa-solid fa-copy"></i>
        </button>
        <a href="${item.dataUrl}" download="${item.fileName}" class="btn btn-small btn-primary" title="Unduh">
          <i class="fa-solid fa-download"></i>
        </a>
      </div>
    `;

    const checkbox = card.querySelector('.page-checkbox');
    checkbox.addEventListener('change', (e) => {
      state.convertedPages[index].selected = e.target.checked;
      card.classList.toggle('selected', e.target.checked);
      updateZipCount();
    });

    const imgWrap = card.querySelector('.card-image-wrap');
    imgWrap.addEventListener('click', () => openModal(index));

    const rotateBtn = card.querySelector('.rotate-card-btn');
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      rotateConvertedItem(index);
    });

    const copyBtn = card.querySelector('.copy-card-btn');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyItemToClipboard(state.convertedPages[index]);
    });

    elements.galleryGrid.appendChild(card);
  });
}

function toggleAllSelections(isSelected) {
  state.convertedPages.forEach(p => p.selected = isSelected);
  document.querySelectorAll('.page-checkbox').forEach(cb => cb.checked = isSelected);
  document.querySelectorAll('.page-card').forEach(card => card.classList.toggle('selected', isSelected));
  updateZipCount();
}

function updateZipCount() {
  const selectedCount = state.convertedPages.filter(p => p.selected).length;
  elements.zipCount.textContent = selectedCount;
  elements.downloadZipBtn.disabled = selectedCount === 0;
}

async function rotateConvertedItem(index) {
  const item = state.convertedPages[index];
  if (!item) return;

  try {
    showToast(`Memutar ${item.fileName}...`, 'info');
    const img = new Image();
    img.src = item.dataUrl;
    await new Promise(resolve => img.onload = resolve);

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    const ctx = canvas.getContext('2d');

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(90 * Math.PI / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    const dataUrl = canvas.toDataURL(item.blob.type || 'image/png');
    const blob = await (await fetch(dataUrl)).blob();

    item.dataUrl = dataUrl;
    item.blob = blob;
    item.width = canvas.width;
    item.height = canvas.height;

    renderGallery();
    showToast(`Berhasil memutar ${item.fileName}!`, 'success');
  } catch (e) {
    console.error('Rotate error:', e);
    showToast('Gagal memutar gambar.', 'error');
  }
}

async function copyItemToClipboard(item) {
  try {
    const response = await fetch(item.dataUrl);
    const blob = await response.blob();

    let pngBlob = blob;
    if (blob.type !== 'image/png') {
      pngBlob = await convertBlobToPng(item.dataUrl);
    }

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': pngBlob })
    ]);
    showToast(`Gambar ${item.fileName} berhasil disalin ke clipboard!`, 'success');
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    showToast('Tidak dapat menyalin gambar ke clipboard di browser ini.', 'error');
  }
}

function convertBlobToPng(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => resolve(blob), 'image/png');
    };
  });
}

async function downloadAsZip() {
  const selectedItems = state.convertedPages.filter(p => p.selected);
  if (selectedItems.length === 0) {
    showToast('Pilih setidaknya satu gambar untuk diunduh.', 'error');
    return;
  }

  showToast('Membuat berkas ZIP...', 'info');
  const JSZip = await getJSZip();
  const zip = new JSZip();
  const folderName = state.fileNameBase ? `${state.fileNameBase}_converted` : 'converted_images';
  const folder = zip.folder(folderName);

  selectedItems.forEach(item => {
    folder.file(item.fileName, item.blob);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipUrl = URL.createObjectURL(zipBlob);
  
  const link = document.createElement('a');
  link.href = zipUrl;
  link.download = `${folderName}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(zipUrl);

  showToast('Berkas ZIP berhasil diunduh!', 'success');
}

// Lightbox Modal Functions
let lastFocusedElement = null;

function openModal(index) {
  if (index < 0 || index >= state.convertedPages.length) return;

  lastFocusedElement = document.activeElement;
  state.currentModalIndex = index;
  state.modalZoom = 1.0;
  state.modalRotation = 0;
  
  updateModalContent();
  elements.previewModal.classList.remove('hidden');
  
  setTimeout(() => {
    elements.modalClose.focus();
  }, 50);
}

function updateModalContent() {
  const item = state.convertedPages[state.currentModalIndex];
  if (!item) return;

  elements.modalTitle.textContent = `${item.fileName} (${item.width}x${item.height}px)`;
  elements.modalImage.src = item.dataUrl;
  elements.modalDownloadLink.href = item.dataUrl;
  elements.modalDownloadLink.download = item.fileName;
  elements.modalPageNum.textContent = `${state.currentModalIndex + 1} / ${state.convertedPages.length}`;

  elements.modalPrevBtn.disabled = state.currentModalIndex === 0;
  elements.modalNextBtn.disabled = state.currentModalIndex === state.convertedPages.length - 1;

  updateModalViewportTransform();
}

function zoomModal(delta) {
  state.modalZoom = Math.min(3.0, Math.max(0.4, state.modalZoom + delta));
  updateModalViewportTransform();
}

function resetModalZoom() {
  state.modalZoom = 1.0;
  state.modalRotation = 0;
  updateModalViewportTransform();
}

function rotateModalImage(degDelta) {
  state.modalRotation = (state.modalRotation + degDelta) % 360;
  updateModalViewportTransform();
}

function updateModalViewportTransform() {
  if (!elements.modalViewport) return;
  elements.modalViewport.style.transform = `scale(${state.modalZoom}) rotate(${state.modalRotation}deg)`;
  if (elements.modalZoomVal) {
    elements.modalZoomVal.textContent = `${Math.round(state.modalZoom * 100)}%`;
  }
}

function copyCurrentModalToClipboard() {
  const item = state.convertedPages[state.currentModalIndex];
  if (item) copyItemToClipboard(item);
}

function showPrevModalImage() {
  if (state.currentModalIndex > 0) {
    state.currentModalIndex--;
    state.modalZoom = 1.0;
    state.modalRotation = 0;
    updateModalContent();
  }
}

function showNextModalImage() {
  if (state.currentModalIndex < state.convertedPages.length - 1) {
    state.currentModalIndex++;
    state.modalZoom = 1.0;
    state.modalRotation = 0;
    updateModalContent();
  }
}

function closeModal() {
  elements.previewModal.classList.add('hidden');
  elements.modalImage.src = '';
  
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

/* ==========================================================================
   2. DOCUMENT MERGER LOGIC (PDF + PNG + JPG + WEBP into 1 PDF with Drag & Drop Sortable)
   ========================================================================== */

async function processMergerFiles(files) {
  const validFiles = files.filter(f => f.size > 0 && (f.type === 'application/pdf' || f.type.startsWith('image/') || /\.(pdf|png|jpe?g|webp|gif|bmp)$/i.test(f.name)));

  if (validFiles.length === 0) {
    showToast('Mohon pilih berkas valid berformat PDF atau Gambar.', 'error');
    return;
  }

  showToast('Membaca info berkas...', 'info');

  for (const file of validFiles) {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    let pageCount = 1;

    if (isPdf) {
      try {
        const pdfjsLib = await getPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        pageCount = pdfDoc.numPages;
      } catch (err) {
        console.warn(`Gagal membaca detail PDF ${file.name}:`, err);
      }
    }

    state.mergerFiles.push({
      id: 'm_' + Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: isPdf ? 'pdf' : 'image',
      pageCount
    });
  }

  renderMergerFileList();
  showToast(`Berhasil menambahkan ${validFiles.length} berkas ke antrean merger.`, 'success');
}

let draggedMergerIndex = null;

function renderMergerFileList() {
  elements.mergerFileList.innerHTML = '';
  elements.mergerFileCount.textContent = state.mergerFiles.length;

  if (state.mergerFiles.length === 0) {
    elements.mergerPanel.classList.add('hidden');
    elements.mergerDropZone.classList.remove('hidden');
    return;
  }

  elements.mergerDropZone.classList.add('hidden');
  elements.mergerPanel.classList.remove('hidden');

  state.mergerFiles.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'merger-file-item';
    itemEl.setAttribute('draggable', 'true');
    itemEl.dataset.index = index;

    const iconClass = item.type === 'pdf' ? 'fa-file-pdf' : 'fa-file-image icon-image';
    const metaText = item.type === 'pdf' ? `${formatBytes(item.size)} • ${item.pageCount} Halaman` : `${formatBytes(item.size)} • 1 Gambar`;

    itemEl.innerHTML = `
      <div class="merger-item-main">
        <span class="drag-handle" title="Geser untuk mengurutkan"><i class="fa-solid fa-grip-vertical"></i></span>
        <span class="merger-item-index">${index + 1}</span>
        <i class="fa-solid ${iconClass} merger-item-icon" aria-hidden="true"></i>
        <div class="merger-item-details">
          <span class="merger-item-name" title="${item.name}">${item.name}</span>
          <span class="merger-item-meta">${metaText}</span>
        </div>
      </div>
      <div class="merger-item-actions">
        <button type="button" class="btn-move move-up-btn" data-index="${index}" title="Naikkan Urutan" ${index === 0 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-up"></i>
        </button>
        <button type="button" class="btn-move move-down-btn" data-index="${index}" title="Turunkan Urutan" ${index === state.mergerFiles.length - 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <button type="button" class="btn-delete-item delete-item-btn" data-index="${index}" title="Hapus Dari Antrean">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;

    // HTML5 Drag & Drop Sortable Event Handlers
    itemEl.addEventListener('dragstart', (e) => {
      draggedMergerIndex = index;
      itemEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    itemEl.addEventListener('dragend', () => {
      draggedMergerIndex = null;
      itemEl.classList.remove('dragging');
    });

    itemEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    itemEl.addEventListener('drop', (e) => {
      e.preventDefault();
      if (draggedMergerIndex !== null && draggedMergerIndex !== index) {
        const targetIndex = index;
        const [movedItem] = state.mergerFiles.splice(draggedMergerIndex, 1);
        state.mergerFiles.splice(targetIndex, 0, movedItem);
        renderMergerFileList();
      }
    });

    itemEl.querySelector('.move-up-btn').addEventListener('click', () => moveMergerItem(index, -1));
    itemEl.querySelector('.move-down-btn').addEventListener('click', () => moveMergerItem(index, 1));
    itemEl.querySelector('.delete-item-btn').addEventListener('click', () => deleteMergerItem(index));

    elements.mergerFileList.appendChild(itemEl);
  });
}

function moveMergerItem(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= state.mergerFiles.length) return;

  const temp = state.mergerFiles[index];
  state.mergerFiles[index] = state.mergerFiles[newIndex];
  state.mergerFiles[newIndex] = temp;

  renderMergerFileList();
}

function deleteMergerItem(index) {
  state.mergerFiles.splice(index, 1);
  renderMergerFileList();
  showToast('Berkas dihapus dari antrean.', 'info');
}

function clearAllMergerFiles() {
  state.mergerFiles = [];
  elements.mergerFileInput.value = '';
  renderMergerFileList();
  showToast('Semua berkas merger dibersihkan.', 'info');
}

async function startMergerProcess() {
  if (state.mergerFiles.length === 0 || state.isMerging) return;

  state.isMerging = true;
  elements.mergerStartBtn.disabled = true;
  elements.mergerProgressCard.classList.remove('hidden');
  updateMergerProgress(0, state.mergerFiles.length, 'Memulai penggabungan dokumen...');

  elements.mergerProgressCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

  try {
    const { PDFDocument, PageSizes } = await getPdfLib();
    const mergedPdf = await PDFDocument.create();

    const pageSizeSetting = elements.mergerPageSize ? elements.mergerPageSize.value : 'auto';
    const orientationSetting = elements.mergerOrientation ? elements.mergerOrientation.value : 'auto';
    const marginSetting = elements.mergerMargin ? elements.mergerMargin.value : 'none';

    let marginPt = 0;
    if (marginSetting === 'small') marginPt = 14.17;
    else if (marginSetting === 'normal') marginPt = 28.35;

    const totalFiles = state.mergerFiles.length;

    for (let i = 0; i < totalFiles; i++) {
      const item = state.mergerFiles[i];
      updateMergerProgress(i, totalFiles, `Memproses (${i + 1}/${totalFiles}) ${item.name}...`);
      await yieldToMainThread(10);

      const arrayBuffer = await item.file.arrayBuffer();

      if (item.type === 'pdf') {
        const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const indices = srcPdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(srcPdf, indices);

        copiedPages.forEach(page => {
          mergedPdf.addPage(page);
        });
      } else {
        let embeddedImage = null;
        const fileType = item.file.type.toLowerCase();

        if (fileType === 'image/png' || item.name.toLowerCase().endsWith('.png')) {
          embeddedImage = await mergedPdf.embedPng(arrayBuffer);
        } else if (fileType === 'image/jpeg' || fileType === 'image/jpg' || /\.(jpe?g)$/i.test(item.name)) {
          embeddedImage = await mergedPdf.embedJpg(arrayBuffer);
        } else {
          const pngArrayBuffer = await convertImageFileToPngArrayBuffer(item.file);
          embeddedImage = await mergedPdf.embedPng(pngArrayBuffer);
        }

        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;

        let pageW = imgWidth;
        let pageH = imgHeight;

        if (pageSizeSetting === 'a4') [pageW, pageH] = PageSizes.A4;
        else if (pageSizeSetting === 'letter') [pageW, pageH] = PageSizes.Letter;
        else if (pageSizeSetting === 'legal') [pageW, pageH] = PageSizes.Legal;

        if (orientationSetting === 'portrait' && pageW > pageH) [pageW, pageH] = [pageH, pageW];
        else if (orientationSetting === 'landscape' && pageH > pageW) [pageW, pageH] = [pageH, pageW];

        const page = mergedPdf.addPage([pageW, pageH]);
        const availW = Math.max(10, pageW - marginPt * 2);
        const availH = Math.max(10, pageH - marginPt * 2);

        const scaleRatio = Math.min(availW / imgWidth, availH / imgHeight, 1.0);
        const drawW = imgWidth * scaleRatio;
        const drawH = imgHeight * scaleRatio;

        const posX = marginPt + (availW - drawW) / 2;
        const posY = marginPt + (availH - drawH) / 2;

        page.drawImage(embeddedImage, { x: posX, y: posY, width: drawW, height: drawH });
      }
    }

    updateMergerProgress(totalFiles, totalFiles, 'Menyusun berkas PDF akhir...');
    await yieldToMainThread(10);

    const mergedPdfBytes = await mergedPdf.save();
    const pdfBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
    const downloadUrl = URL.createObjectURL(pdfBlob);

    const firstItemName = state.mergerFiles[0].name.replace(/\.[^/.]+$/, '');
    const outName = `${firstItemName}_merged.pdf`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = outName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    showToast('Dokumen PDF berhasil digabungkan & diunduh!', 'success');
  } catch (err) {
    console.error('Error merging documents:', err);
    showToast('Gagal menggabungkan dokumen.', 'error');
  } finally {
    state.isMerging = false;
    elements.mergerStartBtn.disabled = false;
    elements.mergerProgressCard.classList.add('hidden');
  }
}

function updateMergerProgress(current, total, statusText) {
  const percent = Math.round((current / total) * 100);
  elements.mergerProgressFill.style.width = `${percent}%`;
  elements.mergerProgressPercent.textContent = `${percent}%`;
  elements.mergerProgressStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${statusText}`;
}

function convertImageFileToPngArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const dataUrl = canvas.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      const arrayBuffer = await blob.arrayBuffer();
      resolve(arrayBuffer);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/* ==========================================================================
   3. PDF SPLITTER & PAGE REMOVER LOGIC
   ========================================================================== */

async function loadSplitterPdf(file) {
  resetSplitterState();
  state.splitterFile = file;

  elements.splitterFileName.textContent = file.name;
  elements.splitterFileMeta.textContent = formatBytes(file.size);
  elements.splitterDropZone.classList.add('hidden');
  elements.splitterPanel.classList.remove('hidden');

  try {
    showToast('Membaca halaman PDF...', 'info');
    const pdfjsLib = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    state.splitterDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    state.splitterTotalPages = state.splitterDocument.numPages;

    elements.splitterFileMeta.textContent = `${formatBytes(file.size)} • ${state.splitterTotalPages} Halaman`;

    // Render page thumbnails
    state.splitterPages = [];
    elements.splitterPagesGrid.innerHTML = '';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    for (let i = 1; i <= state.splitterTotalPages; i++) {
      const page = await state.splitterDocument.getPage(i);
      const viewport = page.getViewport({ scale: 0.3 });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

      state.splitterPages.push({
        pageNum: i,
        selected: false,
        dataUrl
      });
    }

    renderSplitterPagesGrid();
    showToast(`PDF dimuat (${state.splitterTotalPages} halaman)`, 'success');
  } catch (err) {
    console.error('Error loading Splitter PDF:', err);
    showToast('Gagal membaca PDF.', 'error');
    resetSplitterState();
  }
}

function renderSplitterPagesGrid() {
  elements.splitterPagesGrid.innerHTML = '';
  let selectedCount = 0;

  state.splitterPages.forEach((item, index) => {
    if (item.selected) selectedCount++;

    const card = document.createElement('div');
    card.className = `page-card ${item.selected ? 'selected' : ''}`;

    card.innerHTML = `
      <div class="card-top-bar">
        <label class="card-checkbox-label">
          <input type="checkbox" class="splitter-page-cb" ${item.selected ? 'checked' : ''} data-index="${index}" />
          <span>Halaman ${item.pageNum}</span>
        </label>
      </div>
      <div class="card-image-wrap" data-index="${index}">
        <img src="${item.dataUrl}" alt="Halaman ${item.pageNum}" loading="lazy" />
      </div>
    `;

    const cb = card.querySelector('.splitter-page-cb');
    cb.addEventListener('change', (e) => {
      state.splitterPages[index].selected = e.target.checked;
      card.classList.toggle('selected', e.target.checked);
      updateSplitterSelectedCount();
    });

    const imgWrap = card.querySelector('.card-image-wrap');
    imgWrap.addEventListener('click', () => {
      cb.checked = !cb.checked;
      state.splitterPages[index].selected = cb.checked;
      card.classList.toggle('selected', cb.checked);
      updateSplitterSelectedCount();
    });

    elements.splitterPagesGrid.appendChild(card);
  });

  updateSplitterSelectedCount();
}

function updateSplitterSelectedCount() {
  const count = state.splitterPages.filter(p => p.selected).length;
  elements.splitterSelectedCount.textContent = count;
}

function toggleSplitterSelections(isSelected) {
  state.splitterPages.forEach(p => p.selected = isSelected);
  renderSplitterPagesGrid();
}

function resetSplitterState() {
  state.splitterFile = null;
  state.splitterDocument = null;
  state.splitterTotalPages = 0;
  state.splitterPages = [];
  state.isSplitting = false;

  elements.splitterFileInput.value = '';
  elements.splitterPanel.classList.add('hidden');
  elements.splitterDropZone.classList.remove('hidden');
  elements.splitterPagesGrid.innerHTML = '';
}

async function startSplitterProcess() {
  if (!state.splitterFile || state.isSplitting) return;

  const mode = document.querySelector('input[name="split-mode"]:checked').value;
  const selectedPages = state.splitterPages.filter(p => p.selected).map(p => p.pageNum);

  if ((mode === 'extract' || mode === 'delete') && selectedPages.length === 0 && mode !== 'all') {
    showToast('Pilih setidaknya satu halaman terlebih dahulu.', 'error');
    return;
  }

  state.isSplitting = true;
  elements.splitterStartBtn.disabled = true;
  elements.splitterProgressCard.classList.remove('hidden');

  try {
    const { PDFDocument } = await getPdfLib();
    const fileBytes = await state.splitterFile.arrayBuffer();
    const srcDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    const baseName = state.splitterFile.name.replace(/\.pdf$/i, '');

    if (mode === 'all') {
      // Split each page into individual PDFs packaged into ZIP
      showToast('Memisahkan setiap halaman ke PDF terpisah...', 'info');
      const JSZip = await getJSZip();
      const zip = new JSZip();
      const folder = zip.folder(`${baseName}_split_pages`);

      for (let i = 0; i < totalPages; i++) {
        updateSplitterProgress(i, totalPages, `Membuat PDF halaman ${i + 1}...`);
        await yieldToMainThread(10);

        const singlePageDoc = await PDFDocument.create();
        const [copiedPage] = await singlePageDoc.copyPages(srcDoc, [i]);
        singlePageDoc.addPage(copiedPage);

        const pdfBytes = await singlePageDoc.save();
        folder.file(`${baseName}_page_${i + 1}.pdf`, pdfBytes);
      }

      updateSplitterProgress(totalPages, totalPages, 'Mengompresi ZIP...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);

      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `${baseName}_split_pages.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(zipUrl);

      showToast('Setiap halaman berhasil dipisah dan diunduh sebagai ZIP!', 'success');
    } else {
      // Extract or Delete mode
      let targetIndices = [];
      if (mode === 'extract') {
        targetIndices = selectedPages.map(num => num - 1);
      } else if (mode === 'delete') {
        const deleteSet = new Set(selectedPages);
        for (let i = 1; i <= totalPages; i++) {
          if (!deleteSet.has(i)) targetIndices.push(i - 1);
        }
      }

      if (targetIndices.length === 0) {
        showToast('Tidak ada halaman tersisa untuk disimpan.', 'error');
        return;
      }

      updateSplitterProgress(0, 1, 'Membuat dokumen PDF baru...');
      const outDoc = await PDFDocument.create();
      const copiedPages = await outDoc.copyPages(srcDoc, targetIndices);
      copiedPages.forEach(p => outDoc.addPage(p));

      const pdfBytes = await outDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);

      const suffix = mode === 'extract' ? 'extracted' : 'remaining';
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}_${suffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Dokumen PDF berhasil ${mode === 'extract' ? 'diekstrak' : 'diperbarui'}!`, 'success');
    }
  } catch (err) {
    console.error('Error splitting PDF:', err);
    showToast('Gagal memproses pemisahan PDF.', 'error');
  } finally {
    state.isSplitting = false;
    elements.splitterStartBtn.disabled = false;
    elements.splitterProgressCard.classList.add('hidden');
  }
}

function updateSplitterProgress(current, total, statusText) {
  const percent = Math.round((current / total) * 100);
  elements.splitterProgressFill.style.width = `${percent}%`;
  elements.splitterProgressPercent.textContent = `${percent}%`;
  elements.splitterProgressStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${statusText}`;
}

/* ==========================================================================
   4. WATERMARK PDF LOGIC
   ========================================================================== */

async function loadWmPdf(file) {
  resetWmState();
  state.wmFile = file;

  elements.wmFileName.textContent = file.name;
  elements.wmFileMeta.textContent = formatBytes(file.size);
  elements.wmDropZone.classList.add('hidden');
  elements.wmPanel.classList.remove('hidden');

  try {
    showToast('Membaca PDF...', 'info');
    const pdfjsLib = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    state.wmTotalPages = pdfDoc.numPages;

    elements.wmFileMeta.textContent = `${formatBytes(file.size)} • ${state.wmTotalPages} Halaman`;
    showToast(`PDF dimuat (${state.wmTotalPages} Halaman)`, 'success');
  } catch (err) {
    console.error('Error loading Watermark PDF:', err);
    showToast('Gagal membaca PDF.', 'error');
    resetWmState();
  }
}

function resetWmState() {
  state.wmFile = null;
  state.wmDocument = null;
  state.wmTotalPages = 0;
  state.isWatermarking = false;

  elements.wmFileInput.value = '';
  elements.wmPanel.classList.add('hidden');
  elements.wmDropZone.classList.remove('hidden');
}

async function startWatermarkProcess() {
  if (!state.wmFile || state.isWatermarking) return;

  const wmText = elements.wmTextInput.value.trim();
  if (!wmText) {
    showToast('Masukkan teks watermark terlebih dahulu.', 'error');
    return;
  }

  state.isWatermarking = true;
  elements.wmStartBtn.disabled = true;
  elements.wmProgressCard.classList.remove('hidden');
  updateWmProgress(0, state.wmTotalPages, 'Membubuhi watermark...');

  try {
    const { PDFDocument, rgb, degrees, StandardFonts } = await getPdfLib();
    const fileBytes = await state.wmFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const opacity = parseInt(elements.wmOpacitySlider.value, 10) / 100;
    const fontSize = parseInt(elements.wmSizeSlider.value, 10);
    const angleDeg = parseInt(elements.wmAngleSelect.value, 10);
    const colorChoice = elements.wmColorSelect.value;

    let fontColor = rgb(0.93, 0.26, 0.26); // Red default
    if (colorChoice === 'black') fontColor = rgb(0, 0, 0);
    else if (colorChoice === 'gray') fontColor = rgb(0.4, 0.4, 0.4);
    else if (colorChoice === 'blue') fontColor = rgb(0.23, 0.51, 0.96);

    const pages = pdfDoc.getPages();
    const total = pages.length;

    for (let i = 0; i < total; i++) {
      updateWmProgress(i, total, `Membubuhi halaman ${i + 1} dari ${total}...`);
      await yieldToMainThread(10);

      const page = pages[i];
      const { width, height } = page.getSize();

      const textWidth = font.widthOfTextAtSize(wmText, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      const posX = (width - textWidth) / 2;
      const posY = (height - textHeight) / 2;

      page.drawText(wmText, {
        x: posX,
        y: posY,
        size: fontSize,
        font,
        color: fontColor,
        opacity,
        rotate: degrees(angleDeg)
      });
    }

    updateWmProgress(total, total, 'Menyimpan berkas PDF...');
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(pdfBlob);

    const baseName = state.wmFile.name.replace(/\.pdf$/i, '');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}_watermarked.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Watermark berhasil dibubuhi ke dokumen PDF!', 'success');
  } catch (err) {
    console.error('Error applying watermark:', err);
    showToast('Gagal membubuhi watermark pada PDF.', 'error');
  } finally {
    state.isWatermarking = false;
    elements.wmStartBtn.disabled = false;
    elements.wmProgressCard.classList.add('hidden');
  }
}

function updateWmProgress(current, total, statusText) {
  const percent = Math.round((current / total) * 100);
  elements.wmProgressFill.style.width = `${percent}%`;
  elements.wmProgressPercent.textContent = `${percent}%`;
  elements.wmProgressStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${statusText}`;
}

/* ==========================================================================
   5. OCR TEXT EXTRACTION LOGIC (PDF & Image to Text)
   ========================================================================== */

function loadOcrFile(file) {
  resetOcrState();
  state.ocrFile = file;

  if (elements.ocrFileName) elements.ocrFileName.textContent = file.name;
  if (elements.ocrFileMeta) elements.ocrFileMeta.textContent = formatBytes(file.size);
  if (elements.ocrDropZone) elements.ocrDropZone.classList.add('hidden');
  if (elements.ocrPanel) elements.ocrPanel.classList.remove('hidden');

  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
  if (elements.ocrIconBox) {
    elements.ocrIconBox.innerHTML = isPdf ? '<i class="fa-solid fa-file-pdf"></i>' : '<i class="fa-solid fa-file-image icon-image"></i>';
  }

  showToast(`Berkas ${file.name} dimuat untuk OCR.`, 'info');
}

function resetOcrState() {
  state.ocrFile = null;
  state.ocrDocument = null;
  state.ocrExtractedText = '';
  state.isOcrRunning = false;

  elements.ocrFileInput.value = '';
  elements.ocrPanel.classList.add('hidden');
  elements.ocrDropZone.classList.remove('hidden');
  elements.ocrResultCard.classList.add('hidden');
  elements.ocrTextResult.value = '';
}

async function startOcrProcess() {
  if (!state.ocrFile || state.isOcrRunning) return;

  state.isOcrRunning = true;
  elements.ocrStartBtn.disabled = true;
  elements.ocrProgressCard.classList.remove('hidden');
  elements.ocrResultCard.classList.add('hidden');
  updateOcrProgress(0, 100, 'Memulai analisis teks...');

  const isPdf = state.ocrFile.type === 'application/pdf' || state.ocrFile.name.endsWith('.pdf');

  try {
    let fullText = '';

    if (isPdf) {
      const pdfjsLib = await getPdfJs();
      const arrayBuffer = await state.ocrFile.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfDoc.numPages;

      for (let i = 1; i <= numPages; i++) {
        updateOcrProgress(i - 1, numPages, `Mengekstrak teks halaman ${i} dari ${numPages}...`);
        await yieldToMainThread(10);

        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ').trim();

        if (pageText.length > 20) {
          fullText += `--- Halaman ${i} ---\n${pageText}\n\n`;
        } else {
          // Scanned image PDF page: perform Tesseract OCR on page canvas
          updateOcrProgress(i - 1, numPages, `OCR gambar halaman ${i} dari ${numPages}...`);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          const Tesseract = await getTesseract();
          const { data } = await Tesseract.recognize(canvas, 'ind+eng');
          fullText += `--- Halaman ${i} (OCR) ---\n${data.text}\n\n`;
        }
      }
    } else {
      // Image OCR
      updateOcrProgress(30, 100, 'Menjalankan OCR Tesseract pada gambar...');
      const Tesseract = await getTesseract();
      const { data } = await Tesseract.recognize(state.ocrFile, 'ind+eng');
      fullText = data.text;
    }

    updateOcrProgress(100, 100, 'Selesai!');
    state.ocrExtractedText = fullText.trim() || 'Teks tidak ditemukan dalam dokumen.';
    elements.ocrTextResult.value = state.ocrExtractedText;

    setTimeout(() => {
      elements.ocrProgressCard.classList.add('hidden');
      elements.ocrResultCard.classList.remove('hidden');
      elements.ocrResultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Ekstraksi teks OCR berhasil!', 'success');
    }, 300);
  } catch (err) {
    console.error('OCR Error:', err);
    showToast('Gagal mengekstrak teks dari berkas.', 'error');
  } finally {
    state.isOcrRunning = false;
    elements.ocrStartBtn.disabled = false;
  }
}

function updateOcrProgress(current, total, statusText) {
  const percent = Math.round((current / total) * 100);
  elements.ocrProgressFill.style.width = `${percent}%`;
  elements.ocrProgressPercent.textContent = `${percent}%`;
  elements.ocrProgressStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${statusText}`;
}

function copyOcrText() {
  const text = elements.ocrTextResult.value;
  if (!text) return;
  navigator.clipboard.writeText(text);
  showToast('Teks hasil OCR berhasil disalin ke clipboard!', 'success');
}

function downloadOcrTxt() {
  const text = elements.ocrTextResult.value;
  if (!text) return;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const baseName = state.ocrFile ? state.ocrFile.name.replace(/\.[^/.]+$/, '') : 'ocr_text';

  const link = document.createElement('a');
  link.href = url;
  link.download = `${baseName}_extracted.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('Berkas TXT berhasil diunduh!', 'success');
}

// Helper Functions
function parsePageRange(rangeStr, maxPages) {
  if (!rangeStr) return Array.from({ length: maxPages }, (_, i) => i + 1);

  const pages = new Set();
  const parts = rangeStr.split(',');

  parts.forEach(part => {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(num => parseInt(num, 10));
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(maxPages, Math.max(start, end));
        for (let i = min; i <= max; i++) pages.add(i);
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= maxPages) pages.add(num);
    }
  });

  return Array.from(pages).sort((a, b) => a - b);
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconName = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info');
  const icon = document.createElement('i');
  icon.className = `fa-solid ${iconName}`;
  
  const span = document.createElement('span');
  span.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(span);

  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Launch App
document.addEventListener('DOMContentLoaded', init);
