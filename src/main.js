import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import JSZip from 'jszip';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Application State
const state = {
  pdfFile: null,
  pdfDocument: null,
  fileNameBase: '',
  totalPages: 0,
  convertedPages: [], // Array of { pageNum, blob, dataUrl, width, height, selected, fileName }
  isConverting: false,
  currentModalIndex: 0
};

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
  changeFileBtn: document.getElementById('change-file-btn'),
  
  settingsPanel: document.getElementById('settings-panel'),
  formatRadios: document.querySelectorAll('input[name="format"]'),
  qualityGroup: document.getElementById('quality-group'),
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
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      loadPdfFile(files[0]);
    } else {
      showToast('Mohon pilih berkas dengan format PDF valid.', 'error');
    }
  });

  elements.changeFileBtn.addEventListener('click', resetFileState);

  // Format Radio Handler
  elements.formatRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'jpg') {
        elements.qualityGroup.classList.remove('hidden');
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
    // Remove active state from preset buttons if user types custom range
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

    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') showPrevModalImage();
    if (e.key === 'ArrowRight') showNextModalImage();
  });
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

// File Selection Handler
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    loadPdfFile(file);
  } else if (file) {
    showToast('Berkas harus berformat PDF.', 'error');
  }
}

// Load PDF & Parse Page Count
async function loadPdfFile(file) {
  state.pdfFile = file;
  state.fileNameBase = file.name.replace(/\.pdf$/i, '');
  
  // Update File Info UI
  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatBytes(file.size);
  elements.uploadPrompt.classList.add('hidden');
  elements.fileInfo.classList.remove('hidden');
  
  try {
    showToast('Membaca berkas PDF...', 'info');
    const arrayBuffer = await file.arrayBuffer();
    state.pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    state.totalPages = state.pdfDocument.numPages;
    
    elements.filePages.textContent = `${state.totalPages} Halaman`;
    elements.settingsPanel.classList.remove('disabled');
    
    // Set default preset to 'all'
    setPresetFilter('all');
    
    showToast(`PDF Berhasil dimuat (${state.totalPages} Halaman)`, 'success');
  } catch (err) {
    console.error('Error loading PDF:', err);
    showToast('Gagal membaca dokumen PDF. Berkas mungkin terenkripsi atau rusak.', 'error');
    resetFileState();
  }
}

// Reset File State
function resetFileState() {
  state.pdfFile = null;
  state.pdfDocument = null;
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

// Start PDF Conversion
async function startConversion() {
  if (!state.pdfDocument || state.isConverting) return;
  
  state.isConverting = true;
  state.convertedPages = [];
  elements.galleryGrid.innerHTML = '';
  elements.resultsCard.classList.add('hidden');
  elements.progressCard.classList.remove('hidden');
  elements.convertBtn.disabled = true;

  // Scroll to progress bar smoothly
  elements.progressCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Settings
  const selectedFormat = document.querySelector('input[name="format"]:checked').value;
  const mimeType = selectedFormat === 'jpg' ? 'image/jpeg' : 'image/png';
  const quality = parseInt(elements.jpgQualitySlider.value, 10) / 100;
  const scale = parseFloat(elements.scaleSelect.value);
  
  // Page Range Parsing
  const pagesToConvert = parsePageRange(elements.pageRangeInput.value.trim(), state.totalPages);
  
  if (pagesToConvert.length === 0) {
    showToast('Tidak ada halaman valid dalam rentang yang ditentukan.', 'error');
    finishConversion();
    return;
  }

  const total = pagesToConvert.length;
  updateProgress(0, total, 'Memulai rendering...');

  for (let i = 0; i < total; i++) {
    const pageNum = pagesToConvert[i];
    updateProgress(i, total, `Mengonversi halaman ${pageNum} dari ${state.totalPages}...`);

    try {
      const page = await state.pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });
      
      // Render to Offscreen Canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Fill white background for JPG conversion
      if (selectedFormat === 'jpg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // Convert to Data URL & Blob
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const blob = await (await fetch(dataUrl)).blob();
      const outputFileName = `${state.fileNameBase}_page_${pageNum}.${selectedFormat}`;

      const pageObj = {
        pageNum,
        blob,
        dataUrl,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        selected: true,
        fileName: outputFileName
      };

      state.convertedPages.push(pageObj);
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
      showToast(`Gagal merender halaman ${pageNum}`, 'error');
    }
  }

  updateProgress(total, total, 'Selesai!');
  setTimeout(() => {
    elements.progressCard.classList.add('hidden');
    renderGallery();
    elements.resultsCard.classList.remove('hidden');
    finishConversion();
    
    // Smooth scroll to results
    elements.resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`Berhasil mengonversi ${state.convertedPages.length} halaman!`, 'success');
  }, 400);
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

  state.convertedPages.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = `page-card ${item.selected ? 'selected' : ''}`;
    card.dataset.index = index;

    card.innerHTML = `
      <div class="card-top-bar">
        <label class="card-checkbox-label">
          <input type="checkbox" class="page-checkbox" ${item.selected ? 'checked' : ''} data-index="${index}" />
          <span>Halaman ${item.pageNum}</span>
        </label>
        <span class="badge-dim">${item.width} x ${item.height} px</span>
      </div>
      <div class="card-image-wrap" data-index="${index}">
        <img src="${item.dataUrl}" alt="Halaman ${item.pageNum}" loading="lazy" />
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

    // Bind Event Listeners on Card
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

// Download Selected Images as ZIP
async function downloadAsZip() {
  const selectedItems = state.convertedPages.filter(p => p.selected);
  if (selectedItems.length === 0) {
    showToast('Pilih setidaknya satu gambar untuk diunduh.', 'error');
    return;
  }

  showToast('Membuat berkas ZIP...', 'info');
  const zip = new JSZip();
  const folder = zip.folder(`${state.fileNameBase}_images`);

  selectedItems.forEach(item => {
    folder.file(item.fileName, item.blob);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipUrl = URL.createObjectURL(zipBlob);
  
  const link = document.createElement('a');
  link.href = zipUrl;
  link.download = `${state.fileNameBase}_converted_images.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(zipUrl);

  showToast('Berkas ZIP berhasil diunduh!', 'success');
}

// Lightbox Modal Functions & Navigation
function openModal(index) {
  if (index < 0 || index >= state.convertedPages.length) return;

  state.currentModalIndex = index;
  updateModalContent();
  elements.previewModal.classList.remove('hidden');
}

function updateModalContent() {
  const item = state.convertedPages[state.currentModalIndex];
  if (!item) return;

  elements.modalTitle.textContent = `${state.fileNameBase} - Halaman ${item.pageNum} (${item.width}x${item.height}px)`;
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
  
  const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info');
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Launch App
document.addEventListener('DOMContentLoaded', init);
