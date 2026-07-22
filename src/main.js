// Application State
const state = {
  inputMode: 'none', // 'none' | 'pdf' | 'images'
  pdfFile: null,
  pdfDocument: null,
  imageFiles: [], // Array of File objects
  fileNameBase: '',
  totalPages: 0,
  convertedPages: [], // Array of { pageNum, blob, dataUrl, width, height, selected, fileName }
  isConverting: false,
  currentModalIndex: 0
};

// Lazy Loaded Modules Cache
let pdfjsLibModule = null;
let JSZipModule = null;

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

// DOM Elements
const elements = {
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
  pageRangeInput: document.getElementById('page-range-input'),
  presetAllBtn: document.getElementById('preset-all-btn'),
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
  galleryGrid: document.getElementById('gallery-grid'),
  
  previewModal: document.getElementById('preview-modal'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalClose: document.getElementById('modal-close'),
  modalTitle: document.getElementById('modal-title'),
  modalImage: document.getElementById('modal-image'),
  modalDownloadLink: document.getElementById('modal-download-link'),
  modalPrevBtn: document.getElementById('modal-prev-btn'),
  modalNextBtn: document.getElementById('modal-next-btn'),
  modalPageNum: document.getElementById('modal-page-num'),
  
  toastContainer: document.getElementById('toast-container')
};

// Initialize Event Listeners
function init() {
  // File Upload Handlers
  elements.browseBtn.addEventListener('click', () => elements.pdfInput.click());
  elements.pdfInput.addEventListener('change', handleFileSelect);
  
  // Drag & Drop
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

  // Format Radio Handler
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

  // Quality Slider Handler
  elements.jpgQualitySlider.addEventListener('input', (e) => {
    elements.qualityVal.textContent = `${e.target.value}%`;
  });

  // Preset Handlers
  elements.presetAllBtn.addEventListener('click', () => setPresetFilter('all'));
  elements.presetOddBtn.addEventListener('click', () => setPresetFilter('odd'));
  elements.presetEvenBtn.addEventListener('click', () => setPresetFilter('even'));
  
  elements.pageRangeInput.addEventListener('input', () => {
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
  });

  // Conversion Handlers
  elements.convertBtn.addEventListener('click', startConversion);
  elements.selectAllBtn.addEventListener('click', () => toggleAllSelections(true));
  elements.deselectAllBtn.addEventListener('click', () => toggleAllSelections(false));
  elements.downloadZipBtn.addEventListener('click', downloadAsZip);

  // Modal Handlers & Navigation
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalBackdrop.addEventListener('click', closeModal);
  elements.modalPrevBtn.addEventListener('click', showPrevModalImage);
  elements.modalNextBtn.addEventListener('click', showNextModalImage);

  document.addEventListener('keydown', (e) => {
    if (elements.previewModal.classList.contains('hidden')) return;

    if (e.key === 'Escape') {
      closeModal();
      return;
    }
    if (e.key === 'ArrowLeft') showPrevModalImage();
    if (e.key === 'ArrowRight') showNextModalImage();

    // Modal Focus Trap
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
  });
}

// File Selection Handler
function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    processInputFiles(files);
  }
}

// Process Uploaded Files (PDF vs Images)
function processInputFiles(files) {
  // Check for 0-byte empty files
  const emptyFiles = files.filter(f => f.size === 0);
  if (emptyFiles.length > 0) {
    showToast('Terdapat berkas kosong (0 Bytes) yang tidak dapat diproses.', 'error');
    return;
  }

  // Check for large files (> 100 MB)
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

// Preset Filter Handler (All, Odd, Even)
function setPresetFilter(type) {
  document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
  
  if (!state.totalPages) {
    elements.pageRangeInput.value = '';
    return;
  }

  if (type === 'all') {
    elements.presetAllBtn.classList.add('active');
    elements.pageRangeInput.value = '';
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

// Load PDF Document (with Lazy Loaded PDF.js)
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

// Load Image Files (PNG, JPG, WEBP, etc.)
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

// Reset State & Memory Cleanup
function resetFileState() {
  state.inputMode = 'none';
  state.pdfFile = null;
  state.pdfDocument = null;
  state.imageFiles = [];
  state.fileNameBase = '';
  state.totalPages = 0;
  state.convertedPages = [];
  
  elements.pdfInput.value = '';
  elements.fileInfo.classList.add('hidden');
  elements.uploadPrompt.classList.remove('hidden');
  elements.settingsPanel.classList.add('disabled');
  elements.resultsCard.classList.add('hidden');
  elements.progressCard.classList.add('hidden');
  elements.galleryGrid.innerHTML = '';
}

// Start Conversion Process
async function startConversion() {
  if (state.inputMode === 'none' || state.isConverting) return;
  
  state.isConverting = true;
  state.convertedPages = [];
  elements.galleryGrid.innerHTML = '';
  elements.resultsCard.classList.add('hidden');
  elements.progressCard.classList.remove('hidden');
  elements.convertBtn.disabled = true;

  elements.progressCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Options
  const selectedFormat = document.querySelector('input[name="format"]:checked').value;
  let mimeType = 'image/png';
  if (selectedFormat === 'jpg') mimeType = 'image/jpeg';
  else if (selectedFormat === 'webp') mimeType = 'image/webp';
  
  const quality = parseInt(elements.jpgQualitySlider.value, 10) / 100;
  const scale = parseFloat(elements.scaleSelect.value);
  
  const pagesToConvert = parsePageRange(elements.pageRangeInput.value.trim(), state.totalPages);
  
  if (pagesToConvert.length === 0) {
    showToast('Tidak ada item valid dalam rentang yang ditentukan.', 'error');
    finishConversion();
    return;
  }

  const total = pagesToConvert.length;
  updateProgress(0, total, 'Memulai konversi...');

  if (state.inputMode === 'pdf') {
    await convertPdfMode(pagesToConvert, selectedFormat, mimeType, quality, scale);
  } else if (state.inputMode === 'images') {
    await convertImagesMode(pagesToConvert, selectedFormat, mimeType, quality, scale);
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

// Helper: Yield execution to main thread to unblock UI animations & rendering
function yieldToMainThread(ms = 10) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// PDF Conversion Routine
async function convertPdfMode(pagesToConvert, selectedFormat, mimeType, quality, scale) {
  const total = pagesToConvert.length;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < total; i++) {
    const pageNum = pagesToConvert[i];
    updateProgress(i, total, `Mengonversi halaman ${pageNum} dari ${state.totalPages}...`);
    await yieldToMainThread(10);

    try {
      const page = await state.pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (selectedFormat === 'jpg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

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

// Images Conversion Routine (PNG <-> JPG <-> WEBP)
async function convertImagesMode(indicesToConvert, selectedFormat, mimeType, quality, scale) {
  const total = indicesToConvert.length;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

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

      if (selectedFormat === 'jpg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

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

// Helper: Load HTML Image from File Object with memory cleanup
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

// Render Results Gallery Grid
function renderGallery() {
  elements.galleryGrid.innerHTML = '';
  elements.convertedCount.textContent = state.convertedPages.length;
  updateZipCount();

  const isPdf = state.inputMode === 'pdf';

  state.convertedPages.forEach((item, index) => {
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
        <a href="${item.dataUrl}" download="${item.fileName}" class="btn btn-small btn-primary">
          <i class="fa-solid fa-download"></i> Unduh
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

// Download Selected Images as ZIP (with Lazy Loaded JSZip)
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

// Lightbox Modal Functions & Navigation
let lastFocusedElement = null;

function openModal(index) {
  if (index < 0 || index >= state.convertedPages.length) return;

  lastFocusedElement = document.activeElement;
  state.currentModalIndex = index;
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
}

function showPrevModalImage() {
  if (state.currentModalIndex > 0) {
    state.currentModalIndex--;
    updateModalContent();
  }
}

function showNextModalImage() {
  if (state.currentModalIndex < state.convertedPages.length - 1) {
    state.currentModalIndex++;
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

// Helper: Page Range Parser (e.g., "1-3, 5, 8")
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

// Helper: Format File Size Bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper: Toast Notifications
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
