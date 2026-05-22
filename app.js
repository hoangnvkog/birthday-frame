// Birthday Frame App Module
// Handles file upload, image preview with SVG frame overlay,
// zoom controls, preview modal, and download of merged image.

(function () {
  'use strict';

  // ============= Configuration =============
  const CONFIG = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    ZOOM_MIN: 0.5,
    ZOOM_MAX: 3.0,
    ZOOM_STEP: 0.1,
    DEFAULT_ZOOM: 1.0,
  };

  // ============= State =============
  let state = {
    file: null,
    imageUrl: null,
    baseZoom: 1.0,
    modalZoom: 1.0,
    imgObj: null,
    age: '',
  };

  // ============= DOM References =============
  const refs = {}; // will be populated on init

  // ============= Utility Functions =============

  function $(id) {
    return document.getElementById(id);
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function getFileExtension(name) {
    return name ? name.substring(name.lastIndexOf('.')).toLowerCase() : '';
  }

  function isValidFile(file) {
    if (!file) return { valid: false, message: 'No file selected.' };

    const ext = getFileExtension(file.name);
    const typeValid =
      CONFIG.ALLOWED_TYPES.includes(file.type) ||
      CONFIG.ALLOWED_EXTENSIONS.includes(ext);

    if (!typeValid) {
      return {
        valid: false,
        message: 'Invalid file type. Please select an image (JPG, PNG, GIF, WebP).',
      };
    }

    if (file.size > CONFIG.MAX_FILE_SIZE) {
      return {
        valid: false,
        message: 'File is too large. Maximum size is 10MB.',
      };
    }

    return { valid: true };
  }

  function toast(message, type = 'error') {
    let toastEl = document.querySelector('.bf-toast');
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'bf-toast';
      toastEl.style.cssText =
        'position:fixed;bottom:16px;right:16px;padding:12px 20px;border-radius:8px;' +
        'font-size:14px;z-index:9999;transition:opacity 0.3s ease;opacity:0;';
      document.body.appendChild(toastEl);
    }

    const bgColor = type === 'success' ? '#10B981' : type === 'info' ? '#3B82F6' : '#EF4444';
    const textColor = '#ffffff';
    toastEl.textContent = message;
    toastEl.style.backgroundColor = bgColor;
    toastEl.style.color = textColor;
    toastEl.style.opacity = '1';

    // auto-hide after 3s
    if (toastEl._hideTimeout) clearTimeout(toastEl._hideTimeout);
    toastEl._hideTimeout = setTimeout(() => {
      toastEl.style.opacity = '0';
    }, 3000);
  }

  // ============= Image Processing =============

  function loadImage(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = imageUrl;
    });
  }

  function syncImageSize() {
    const avatar = refs.imgAvatar;
    const image = refs.userImage;
    if (!avatar || !image) return;
    image.style.width = avatar.clientWidth + 'px';
    image.style.height = avatar.clientHeight + 'px';
  }

  // ============= SVG Frame Handling =============

  /**
   * Returns the resolved SVG string of the frame.
   * Expects frame element to exist, contains <svg> or is an <img> with .svg.
   * This builder looks for an #frame element (or an element with data-frame role)
   * and returns a standard SVG overlay.
   */
  function getFrameSvg() {
    // 1. Prefer explicit <svg id="frame">
    const frameSvg = document.getElementById('frame');
    if (frameSvg && frameSvg.tagName.toLowerCase() === 'svg') {
      return new XMLSerializer().serializeToString(frameSvg);
    }

    // 2. Fallback: if there's an <img> with SVG src
    const frameImg = document.getElementById('frame');
    if (frameImg && frameImg.tagName.toLowerCase() === 'img') {
      // This requires the SVG loaded in DOM or known source.
      // We'll try to fetch it, but for synchronous purposes, fallback to a basic frame
      return null;
    }

    // 3. Default frame (a simple birthday frame)
    const w = 400;
    const h = 400;
    const ageText = state.age || '';
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      w +
      '" height="' +
      h +
      '" viewBox="0 0 ' +
      w +
      ' ' +
      h +
      '">' +
      '<rect x="10" y="10" width="' +
      (w - 20) +
      '" height="' +
      (h - 20) +
      '" rx="12" fill="none" stroke="#fbbf24" stroke-width="20"/>' +
      (ageText
        ? '<text x="50%" y="30" dominant-baseline="middle" text-anchor="middle" fill="#fbbf24" font-size="24" font-family="Arial, sans-serif" font-weight="bold">' +
          escapeXml(ageText) +
          '</text>'
        : '') +
      '<text x="50%" y="' +
      (h - 30) +
      '" dominant-baseline="middle" text-anchor="middle" fill="#fbbf24" font-size="16" font-family="Arial, sans-serif">' +
      escapeXml('Happy Birthday! 🎉') +
      '</text>' +
      '</svg>'
    );
  }

  function escapeXml(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ============= Core Feature: Upload =============

  function handleFileSelect(file) {
    const validation = isValidFile(file);
    if (!validation.valid) {
      toast(validation.message, 'error');
      return;
    }

    state.file = file;
    state.baseZoom = CONFIG.DEFAULT_ZOOM;
    state.modalZoom = CONFIG.DEFAULT_ZOOM;

    if (state.imageUrl) {
      URL.revokeObjectURL(state.imageUrl);
    }
    state.imageUrl = URL.createObjectURL(file);

    // Update UI
    refs.filePreview.style.display = '';
    refs.fileName.textContent = file.name + ' (' + formatFileSize(file.size) + ')';
    refs.placeholderText.style.display = 'none';
    refs.zoomControls.style.display = '';
    refs.userImage.style.display = 'block';

    // Enable buttons
    refs.btnPreview.disabled = false;
    refs.btnDownload.disabled = false;

    // Reset zoom slider
    refs.zoomSlider.value = state.baseZoom;

    // Set image source
    refs.userImage.setAttribute('src', state.imageUrl);

    // Load image for state.imgObj
    loadImage(state.imageUrl)
      .then((img) => {
        state.imgObj = img;
        syncImageSize();
        applyBaseZoom();
      })
      .catch((err) => {
        toast('Failed to load image: ' + (err && err.message ? err.message : 'Unknown error'), 'error');
      });
  }

  function clearFile() {
    if (state.imageUrl) {
      URL.revokeObjectURL(state.imageUrl);
    }
    state.file = null;
    state.imageUrl = null;
    state.imgObj = null;

    refs.filePreview.style.display = 'none';
    refs.placeholderText.style.display = '';
    refs.zoomControls.style.display = 'none';
    refs.userImage.style.display = 'none';
    refs.userImage.removeAttribute('src');

    refs.btnPreview.disabled = true;
    refs.btnDownload.disabled = true;

    refs.inputImage.value = '';

    state.baseZoom = CONFIG.DEFAULT_ZOOM;
    refs.zoomSlider.value = state.baseZoom;
    applyBaseZoom();
  }

  // ============= Zoom Logic =============

  function applyBaseZoom() {
    if (!state.imgObj) return;
    const zoom = parseFloat(refs.zoomSlider.value) || 1.0;
    state.baseZoom = zoom;
    if (refs.userImage) {
      refs.userImage.style.transform = 'scale(' + zoom + ')';
    }
  }

  function changeZoom(delta) {
    let newZoom = parseFloat(refs.zoomSlider.value) + delta;
    newZoom = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, newZoom));
    refs.zoomSlider.value = newZoom.toFixed(2);
    applyBaseZoom();
  }

  // ============= Canvas Merge Logic =============

  /**
   * Renders user image + frame overlay into a canvas.
   * Returns { canvas, ctx }.
   */
  async function renderMergedToCanvas(targetCanvas, opts = {}) {
    opts = Object.assign({ width: 512, height: 512, zoom: 1.0, fillBg: null }, opts);

    const canvas = targetCanvas || document.createElement('canvas');
    const w = (canvas.width = opts.width);
    const h = (canvas.height = opts.height);
    const ctx = canvas.getContext('2d');

    // Background fill
    if (opts.fillBg) {
      ctx.fillStyle = opts.fillBg;
      ctx.fillRect(0, 0, w, h);
    }

    // Draw user image centered and scaled by zoom
    if (state.imgObj) {
      const img = state.imgObj;
      const zoom = opts.zoom || 1.0;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;

      // "Cover" approach within canvas while allowing zoom adjustment
      const canvasAspect = w / h;
      const imgAspect = iw / ih;
      let drawW,
        drawH,
        sx = 0,
        sy = 0;

      if (imgAspect > canvasAspect) {
        drawH = h / zoom;
        drawW = drawH * imgAspect;
        sx = -(drawW - w) / 2;
        sy = -(drawH - h) / 2;
      } else {
        drawW = w / zoom;
        drawH = drawW / imgAspect;
        sx = -(drawW - w) / 2;
        sy = -(drawH - h) / 2;
      }

      // Draw clipped to canvas area (cover with no blank spaces)
      const scale = Math.max(w / (iw * zoom), h / (ih * zoom));
      drawW = iw * scale * zoom;
      drawH = ih * scale * zoom;
      sx = (w - drawW) / 2;
      sy = (h - drawH) / 2;

      ctx.drawImage(img, sx, sy, drawW, drawH);
    }

    // Draw Frame SVG
    const svgData = getFrameSvg();
    if (svgData) {
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const frameImg = new Image();
      await new Promise((resolve, reject) => {
        frameImg.onload = resolve;
        frameImg.onerror = () => {
          reject(new Error('Failed to load frame'));
        };
        frameImg.src = url;
      });

      ctx.drawImage(frameImg, 0, 0, w, h);
      URL.revokeObjectURL(url);
    }

    return { canvas, ctx };
  }

  // ============= Preview Modal =============

  async function openPreview() {
    if (!state.imgObj) {
      toast('Please upload an image first.', 'error');
      return;
    }

    refs.previewModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Render initial view
    try {
      await renderModalPreview();
    } catch (err) {
      toast('Failed to render preview: ' + (err && err.message ? err.message : 'Unknown error'), 'error');
    }
  }

  function closePreview() {
    refs.previewModal.style.display = 'none';
    document.body.style.overflow = '';
  }

  async function renderModalPreview() {
    const canvas = refs.modalCanvas;
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const size = Math.max(1, Math.min(rect.width, rect.height));

    await renderMergedToCanvas(canvas, {
      width: size,
      height: size,
      zoom: state.modalZoom,
    });
  }

  // ============= Download =============

  async function performDownload(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename || 'birthday-frame.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function onClickDownload() {
    if (!state.imgObj) {
      toast('Please upload an image first.', 'error');
      return;
    }
    try {
      const { canvas } = await renderMergedToCanvas(refs.processCanvas, {
        width: 1024,
        height: 1024,
        zoom: state.baseZoom,
      });
      await performDownload(canvas, 'my-birthday-frame.jpg');
      toast('Image downloaded successfully!', 'success');
    } catch (err) {
      toast('Download failed: ' + (err && err.message ? err.message : 'Unknown error'), 'error');
    }
  }

  async function onModalDownload() {
    if (!state.imgObj) return;
    try {
      const { canvas } = await renderMergedToCanvas(refs.processCanvas, {
        width: 1024,
        height: 1024,
        zoom: state.modalZoom,
      });
      await performDownload(canvas, 'my-birthday-frame.jpg');
      toast('Image downloaded successfully!', 'success');
    } catch (err) {
      toast('Download failed: ' + (err && err.message ? err.message : 'Unknown error'), 'error');
    }
  }

  // ============= Event Listeners =============

  function initEvents() {
    // Drop zone click (open file picker)
    refs.dropZone.addEventListener('click', (e) => {
      if (e.target !== refs.inputImage && !refs.inputImage.contains(e.target) && !refs.removeFile.contains(e.target)) {
        refs.inputImage.click();
      }
    });

    // Drag & Drop on drop zone
    refs.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      refs.dropZone.classList.add('dragover');
    });

    refs.dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      refs.dropZone.classList.remove('dragover');
    });

    refs.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      refs.dropZone.classList.remove('dragover');
      const dt = e.dataTransfer;
      const files = dt ? dt.files : null;
      if (files && files.length) handleFileSelect(files[0]);
    });

    // File input change
    refs.inputImage.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length) handleFileSelect(e.target.files[0]);
    });

    // Remove file
    refs.removeFile.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearFile();
    });

    // Age input
    refs.inputAge.addEventListener('input', (e) => {
      state.age = e.target.value;
    });

    // Preview button
    refs.btnPreview.addEventListener('click', (e) => {
      e.preventDefault();
      openPreview();
    });

    // Download button
    refs.btnDownload.addEventListener('click', (e) => {
      e.preventDefault();
      onClickDownload();
    });

    // Zoom controls
    refs.zoomSlider.addEventListener('input', () => {
      applyBaseZoom();
    });
    refs.zoomIn.addEventListener('click', () => changeZoom(CONFIG.ZOOM_STEP));
    refs.zoomOut.addEventListener('click', () => changeZoom(-CONFIG.ZOOM_STEP));

    // Modal zoom controls
    refs.modalZoomSlider.addEventListener('input', async () => {
      state.modalZoom = parseFloat(refs.modalZoomSlider.value) || 1.0;
      try {
        await renderModalPreview();
      } catch (err) {
        toast('Preview update failed.', 'error');
      }
    });
    refs.modalZoomIn.addEventListener('click', async () => {
      let z = parseFloat(refs.modalZoomSlider.value) + CONFIG.ZOOM_STEP;
      z = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, z));
      refs.modalZoomSlider.value = z.toFixed(2);
      state.modalZoom = z;
      try {
        await renderModalPreview();
      } catch (err) {
        toast('Preview update failed.', 'error');
      }
    });
    refs.modalZoomOut.addEventListener('click', async () => {
      let z = parseFloat(refs.modalZoomSlider.value) - CONFIG.ZOOM_STEP;
      z = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, z));
      refs.modalZoomSlider.value = z.toFixed(2);
      state.modalZoom = z;
      try {
        await renderModalPreview();
      } catch (err) {
        toast('Preview update failed.', 'error');
      }
    });

    // Close modal
    refs.closeModal.addEventListener('click', (e) => {
      e.preventDefault();
      closePreview();
    });

    // Click outside modal content to close
    refs.previewModal.addEventListener('click', (e) => {
      if (e.target === refs.previewModal) closePreview();
    });

    // Modal download
    refs.modalDownload.addEventListener('click', (e) => {
      e.preventDefault();
      onModalDownload();
    });

    // Keyboard shortcuts for modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && refs.previewModal.style.display === 'flex') {
        closePreview();
      }
    });

    // Window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        syncImageSize();
        // Re-render modal if open
        if (refs.previewModal.style.display === 'flex') {
          renderModalPreview().catch(() => {});
        }
      }, 150);
    });
  }

  // ============= Initialize =============

  function init() {
    // Collect refs
    const ids = [
      'dropZone',
      'inputImage',
      'userImage',
      'imgAvatar',
      'placeholderText',
      'filePreview',
      'fileName',
      'removeFile',
      'inputAge',
      'btnPreview',
      'btnDownload',
      'zoomControls',
      'zoomSlider',
      'zoomIn',
      'zoomOut',
      'previewModal',
      'closeModal',
      'modalCanvas',
      'modalZoomSlider',
      'modalZoomIn',
      'modalZoomOut',
      'modalDownload',
      'processCanvas',
    ];
    for (const id of ids) {
      refs[id] = $(id);
    }

    // Set initial state UI
    if (refs.dropZone) refs.dropZone.style.cursor = 'pointer';
    if (refs.btnPreview) refs.btnPreview.disabled = true;
    if (refs.btnDownload) refs.btnDownload.disabled = true;
    if (refs.filePreview) refs.filePreview.style.display = 'none';
    if (refs.zoomControls) refs.zoomControls.style.display = 'none';
    if (refs.previewModal) refs.previewModal.style.display = 'none';
    if (refs.zoomSlider) {
      refs.zoomSlider.min = CONFIG.ZOOM_MIN;
      refs.zoomSlider.max = CONFIG.ZOOM_MAX;
      refs.zoomSlider.step = CONFIG.ZOOM_STEP;
      refs.zoomSlider.value = CONFIG.DEFAULT_ZOOM;
    }
    if (refs.modalZoomSlider) {
      refs.modalZoomSlider.min = CONFIG.ZOOM_MIN;
      refs.modalZoomSlider.max = CONFIG.ZOOM_MAX;
      refs.modalZoomSlider.step = CONFIG.ZOOM_STEP;
      refs.modalZoomSlider.value = CONFIG.DEFAULT_ZOOM;
    }

    initEvents();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();