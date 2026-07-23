import { inject } from '@vercel/analytics';

// Initialize Vercel Analytics tracking
inject();

// Application State
const state = {
  activeTab: 'converter', // 'converter' | 'merger'
  inputMode: 'none', // 'none' | 'pdf' | 'images'
  pdfFile: null,
  pdfDocument: null,
  imageFiles: [], // Array of File objects
  fileNameBase: '',
  totalPages: 0,
  convertedPages: [], // Array of { pageNum, blob, dataUrl, width, height, selected, fileName }
  isConverting: false,
  currentModalIndex: 0,
  modalZoom: 1.0,
  modalRotation: 0,
  galleryFilterQuery: '',

  // Merger State
  mergerFiles: [], // Array of { id, file, name, size, type, pageCount, dataUrl }
  isMerging: false
};

// Lazy Loaded Modules Cache
let pdfjsLibModule = null;
let JSZipModule = null;
let pdfLibModule = null;

// Lazy load PDF.js Engine
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

// Lazy load JSZip Engine
async function getJSZip() {
  if (!JSZipModule) {
    const jszipModule = await import('jszip');
    JSZipModule = jszipModule.default || jszipModule;
  }
  return JSZipModule;
}

// Lazy load PDF-Lib Engine
async function getPdfLib() {
  if (!pdfLibModule) {
    pdfLibModule = await import('pdf-lib');
  }
  return pdfLibModule;
}

// DOM Elements
const elements = {
  // Navigation Tabs
  tabConverter: document.getElementById('tab-converter'),
  tabMerger: document.getElementById('tab-merger'),
  converterSection: document.getElementById('converter-section'),
  mergerSection: document.getElementById('merger-section'),

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

  toastContainer: document.getElementById('toast-container')
};

// Initialize App
function init() {
  initTabNavigation();

  // Converter Handlers
  elements.browseBtn.addEventListener('click', () => elements.pdfInput.click());
  elements.pdfInput.addEventListener('change', handleFileSelect);
  
  ['dragenter', 'dragover'].forEach(eventName => {
    elements.dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    elements.dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.dropZone.classList.remove('drag-over');
    });
  });

  elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processInputFiles(files);
    }
  });

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
  }

  if (elements.mergerAddMoreBtn) {
    elements.mergerAddMoreBtn.addEventListener('click', () => elements.mergerFileInput.click());
    elements.mergerClearAllBtn.addEventListener('click', clearAllMergerFiles);
  }

  if (elements.mergerDropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      elements.mergerDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        elements.mergerDropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      elements.mergerDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        elements.mergerDropZone.classList.remove('drag-over');
      });
    });

    elements.mergerDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.mergerDropZone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) processMergerFiles(files);
    });
  }

  if (elements.mergerStartBtn) {
    elements.mergerStartBtn.addEventListener('click', startMergerProcess);
  }

  document.addEventListener('keydown', handleGlobalKeydown);
}

// App Mode Navigation Tabs
function initTabNavigation() {
  if (!elements.tabConverter || !elements.tabMerger) return;

  elements.tabConverter.addEventListener('click', () => switchTab('converter'));
  elements.tabMerger.addEventListener('click', () => switchTab('merger'));
}

function switchTab(tab) {
  state.activeTab = tab;
  const isConverter = tab === 'converter';

  elements.tabConverter.classList.toggle('active', isConverter);
  elements.tabConverter.setAttribute('aria-selected', isConverter ? 'true' : 'false');

  elements.tabMerger.classList.toggle('active', !isConverter);
  elements.tabMerger.setAttribute('aria-selected', !isConverter ? 'true' : 'false');

  elements.converterSection.classList.toggle('hidden', !isConverter);
  elements.mergerSection.classList.toggle('hidden', isConverter);
}

// Keyboard Shortcuts
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

  if (e.key === 'Tab') {
    const focusables = Array.from(elements.previewModal.querySelectorAll('button:not([disabled]), a[href]:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }
}

// Converter File Selection Handler
function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    processInputFiles(files);
  }
}

function processInputFiles(files) {
  const emptyFiles = files.filter(f => f.size === 0);
  if (emptyFiles.length > 0) {
    showToast('Terdapat berkas kosong (0 Bytes) yang tidak dapat diproses.', 'error');
    return;
  }

  const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);
  if (totalSizeBytes > 100 * 1024 * 1024) {
    showToast('Berkas terdeteksi cukup besar (>100 MB). Proses konversi mungkin membutuhkan memori & waktu lebih.', 'info');
  }

  const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  const imageFiles = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name));

  if (pdfFiles.length > 0) {
    loadPdfFile(pdfFiles[0]);
  } else if (imageFiles.length > 0) {
    loadImageFiles(imageFiles);
  } else {
    showToast('Mohon pilih berkas berformat PDF atau Gambar valid (PNG/JPG/WEBP).', 'error');
  }
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

function sharpenImageData(ctx, width, height, mix = 0.25) {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const copy = new Uint8ClampedArray(pixels);
    const w = width;
    const h = height;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const i = idx + c;
          const top = i - w * 4;
          const bottom = i + w * 4;
          const left = i - 4;
          const right = i + 4;

          const sharp = 5 * copy[i] - copy[top] - copy[bottom] - copy[left] - copy[right];
          pixels[i] = Math.min(255, Math.max(0, Math.round(copy[i] * (1 - mix) + sharp * mix)));
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.warn('Sharpening filter bypassed:', e);
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

      if (scale > 1.0) {
        const sharpMix = Math.min(0.3, 0.12 * scale);
        sharpenImageData(ctx, canvas.width, canvas.height, sharpMix);
      }

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
   DOCUMENT MERGER LOGIC (PDF + PNG + JPG + WEBP into 1 PDF)
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

    const iconClass = item.type === 'pdf' ? 'fa-file-pdf' : 'fa-file-image icon-image';
    const metaText = item.type === 'pdf' ? `${formatBytes(item.size)} • ${item.pageCount} Halaman` : `${formatBytes(item.size)} • 1 Gambar`;

    itemEl.innerHTML = `
      <div class="merger-item-main">
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

// Perform Document Merger & Create Downloadable PDF
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

    // Margin in points (1mm = 2.83465 pt)
    let marginPt = 0;
    if (marginSetting === 'small') marginPt = 14.17; // 5mm
    else if (marginSetting === 'normal') marginPt = 28.35; // 10mm

    const totalFiles = state.mergerFiles.length;

    for (let i = 0; i < totalFiles; i++) {
      const item = state.mergerFiles[i];
      updateMergerProgress(i, totalFiles, `Memproses (${i + 1}/${totalFiles}) ${item.name}...`);
      await yieldToMainThread(10);

      const arrayBuffer = await item.file.arrayBuffer();

      if (item.type === 'pdf') {
        // Merge PDF pages
        const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const indices = srcPdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(srcPdf, indices);

        copiedPages.forEach(page => {
          mergedPdf.addPage(page);
        });
      } else {
        // Embed Image
        let embeddedImage = null;
        const fileType = item.file.type.toLowerCase();

        if (fileType === 'image/png' || item.name.toLowerCase().endsWith('.png')) {
          embeddedImage = await mergedPdf.embedPng(arrayBuffer);
        } else if (fileType === 'image/jpeg' || fileType === 'image/jpg' || /\.(jpe?g)$/i.test(item.name)) {
          embeddedImage = await mergedPdf.embedJpg(arrayBuffer);
        } else {
          // WEBP / Other images: convert via Canvas to PNG ArrayBuffer
          const pngArrayBuffer = await convertImageFileToPngArrayBuffer(item.file);
          embeddedImage = await mergedPdf.embedPng(pngArrayBuffer);
        }

        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;

        let pageW = imgWidth;
        let pageH = imgHeight;

        // Custom Page Sizes
        if (pageSizeSetting === 'a4') {
          [pageW, pageH] = PageSizes.A4;
        } else if (pageSizeSetting === 'letter') {
          [pageW, pageH] = PageSizes.Letter;
        } else if (pageSizeSetting === 'legal') {
          [pageW, pageH] = PageSizes.Legal;
        }

        // Custom Orientation
        if (orientationSetting === 'portrait' && pageW > pageH) {
          [pageW, pageH] = [pageH, pageW];
        } else if (orientationSetting === 'landscape' && pageH > pageW) {
          [pageW, pageH] = [pageH, pageW];
        }

        const page = mergedPdf.addPage([pageW, pageH]);

        // Draw image fit within printable area (considering margins)
        const availW = Math.max(10, pageW - marginPt * 2);
        const availH = Math.max(10, pageH - marginPt * 2);

        const scaleRatio = Math.min(availW / imgWidth, availH / imgHeight, 1.0);
        const drawW = imgWidth * scaleRatio;
        const drawH = imgHeight * scaleRatio;

        const posX = marginPt + (availW - drawW) / 2;
        const posY = marginPt + (availH - drawH) / 2;

        page.drawImage(embeddedImage, {
          x: posX,
          y: posY,
          width: drawW,
          height: drawH
        });
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
    showToast('Gagal menggabungkan dokumen. Pastikan berkas tidak terenkripsi.', 'error');
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

// Helper Functions
function parsePageRange(rangeStr, maxPages) {
  if (!rangeStr) {
    return Array.from({ length: maxPages }, (_, i) => i + 1);
  }

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
      if (!isNaN(num) && num >= 1 && num <= maxPages) {
        pages.add(num);
      }
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
