/**
 * RỰC RỠ TUỔI 18 - Birthday Frame App
 * Client-side image processing with Canvas API
 */

// ===== DOM Elements =====
const dropZone = document.getElementById('dropZone');
const inputImage = document.getElementById('inputImage');
const userImage = document.getElementById('userImage');
const imgAvatar = document.getElementById('imgAvatar');
const placeholderText = document.getElementById('placeholderText');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const inputAge = document.getElementById('inputAge');
const btnPreview = document.getElementById('btnPreview');
const btnDownload = document.getElementById('btnDownload');
const zoomControls = document.getElementById('zoomControls');
const zoomSlider = document.getElementById('zoomSlider');
const zoomOut = document.getElementById('zoomOut');
const zoomIn = document.getElementById('zoomIn');
const previewModal = document.getElementById('previewModal');
const closeModal = document.getElementById('closeModal');
const modalImageContainer = document.getElementById('modalImageContainer');
const modalCanvas = document.getElementById('modalCanvas');
const modalZoomSlider = document.getElementById('modalZoomSlider');
const modalZoomOut = document.getElementById('modalZoomOut');
const modalZoomIn = document.getElementById('modalZoomIn');
const modalDownload = document.getElementById('modalDownload');
const processCanvas = document.getElementById('processCanvas');

// ===== State =====
let currentImage = null;
let currentZoom = 100;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let imageOffset = { x: 0, y: 0 };
let modalZoom = 100;
let showToastHandler = null;

// ===== Constants =====
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ===== Event Listeners =====

// Drop zone events
dropZone.addEventListener('click', () => inputImage.click());

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('is-dragover');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('is-dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('is-dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// File input change
inputImage.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Remove file
removeFile.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetImage();
});

// Preview button
btnPreview.addEventListener('click', () => {
    openPreview();
});

// Download button
btnDownload.addEventListener('click', () => {
    downloadImage('download');
});

// Close modal
closeModal.addEventListener('click', () => {
    closePreview();
});

// Modal download
modalDownload.addEventListener('click', () => {
    downloadImage('modal');
});

// Zoom controls
zoomSlider.addEventListener('input', (e) => {
    currentZoom = e.target.value;
    applyZoom();
});

zoomOut.addEventListener('click', () => {
    currentZoom = Math.max(10, currentZoom - 10);
    zoomSlider.value = currentZoom;
    applyZoom();
});

zoomIn.addEventListener('click', () => {
    currentZoom = Math.min(300, parseInt(currentZoom) + 10);
    zoomSlider.value = currentZoom;
    applyZoom();
});

// Modal zoom
modalZoomSlider.addEventListener('input', (e) => {
    modalZoom = e.target.value;
    const scale = modalZoom / 100;
    modalCanvas.style.transform = `scale(${scale})`;
});

modalZoomOut.addEventListener('click', () => {
    modalZoom = Math.max(10, modalZoom - 10);
    modalZoomSlider.value = modalZoom;
    const scale = modalZoom / 100;
    modalCanvas.style.transform = `scale(${scale})`;
});

modalZoomIn.addEventListener('click', () => {
    modalZoom = Math.min(300, parseInt(modalZoom) + 10);
    modalZoomSlider.value = modalZoom;
    const scale = modalZoom / 100;
    modalCanvas.style.transform = `scale(${scale})`;
});

// Close modal on backdrop click
previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
        closePreview();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !previewModal.classList.contains('hidden')) {
        closePreview();
    }
});

// Drag functionality for image moving
imgAvatar.addEventListener('mousedown', (e) => {
    if (!currentImage) return;
    isDragging = true;
    dragStart = { x: e.clientX - imageOffset.x, y: e.clientY - imageOffset.y };
    imgAvatar.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    imageOffset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
    };
    applyZoom();
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    imgAvatar.style.cursor = 'default';
});

// ===== Functions =====

/**
 * Handle uploaded file
 */
function handleFile(file) {
    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
        showToast('Vui lòng chọn tệp hình ảnh (JPG, PNG, GIF)', 'error');
        return;
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        showToast('Ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            displayImage(img);
            showFilePreview(file.name);
            enableButtons();
            zoomControls.classList.remove('hidden');
            showToast('Ảnh đã tải lên thành công!', 'success');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Display image in preview area
 */
function displayImage(img) {
    userImage.src = img.src;
    userImage.classList.remove('hidden');
    placeholderText.classList.add('hidden');
    updateImagePosition();
}

/**
 * Show file preview info
 */
function showFilePreview(name) {
    fileName.textContent = name;
    filePreview.classList.remove('hidden');
    dropZone.querySelector('.text').textContent = 'Thay đổi ảnh';
}

/**
 * Reset image state
 */
function resetImage() {
    currentImage = null;
    userImage.src = '';
    userImage.classList.add('hidden');
    placeholderText.classList.remove('hidden');
    filePreview.classList.add('hidden');
    inputImage.value = '';
    dropZone.querySelector('.text').textContent = 'Kéo và thả hoặc tải lên hình ảnh';
    disableButtons();
    zoomControls.classList.add('hidden');
    imageOffset = { x: 0, y: 0 };
    currentZoom = 100;
    zoomSlider.value = 100;
}

/**
 * Enable action buttons
 */
function enableButtons() {
    btnPreview.disabled = false;
    btnDownload.disabled = false;
}

/**
 * Disable action buttons
 */
function disableButtons() {
    btnPreview.disabled = true;
    btnDownload.disabled = true;
}

/**
 * Apply zoom transformation
 */
function applyZoom() {
    if (!currentImage) return;
    const scale = currentZoom / 100;
    const imageElement = userImage;
    imageElement.style.transform = `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${scale})`;
}

/**
 * Update image position and size
 */
function updateImagePosition() {
    if (!currentImage) return;
    applyZoom();
}

// ===== SVG Frame Data =====
const svgFrameContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
    <defs>
        <pattern id="bgPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#c71585" opacity="0.05"/>
            <circle cx="10" cy="10" r="2" fill="#c71585" opacity="0.15"/>
            <circle cx="30" cy="30" r="2" fill="#c71585" opacity="0.15"/>
        </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bgPattern)"/>
    <g id="corners">
        <path d="M0 0 L60 0 Q40 40 0 60 Z" fill="#c71585" opacity="0.9"/>
        <path d="M0 0 L45 0 Q30 30 0 45 Z" fill="#ff69b4"/>
        <path d="M400 0 L340 0 Q360 40 400 60 Z" fill="#c71585" opacity="0.9"/>
        <path d="M400 0 L355 0 Q370 30 400 45 Z" fill="#ff69b4"/>
        <path d="M0 400 L60 400 Q40 360 0 340 Z" fill="#c71585" opacity="0.9"/>
        <path d="M0 400 L45 400 Q30 370 0 355 Z" fill="#ff69b4"/>
        <path d="M400 400 L340 400 Q360 360 400 340 Z" fill="#c71585" opacity="0.9"/>
        <path d="M400 400 L355 400 Q370 370 400 355 Z" fill="#ff69b4"/>
    </g>
    <g fill="#FFD700">
        <path d="M30 80 L32 85 L37 85 L33 88 L35 93 L30 90 L25 93 L27 88 L23 85 L28 85 Z"/>
        <path d="M370 120 L371 123 L374 123 L372 125 L373 128 L370 126 L367 128 L368 125 L366 123 L369 123 Z"/>
        <path d="M50 350 L51 352 L54 352 L52 354 L53 356 L50 355 L47 356 L48 354 L46 352 L49 352 Z"/>
        <path d="M350 370 L352 373 L357 373 L354 375 L355 378 L352 376 L349 378 L350 375 L348 373 L351 373 Z"/>
    </g>
    <text x="200" y="50" text-anchor="middle" fill="#c71585" font-family="serif" font-weight="700" font-size="32">18</text>
    <text x="200" y="75" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="14" fill="#c71585">TUỔI</text>
    <text x="200" y="380" text-anchor="middle" fill="#c71585" font-family="sans-serif" font-weight="700" font-size="16">HAPPY 18TH BIRTHDAY</text>
    <path d="M0 180 Q50 160 80 180 T160 180 T240 180 T320 180 T400 170" stroke="#ff69b4" stroke-width="3" fill="none" opacity="0.5" stroke-dasharray="5,5"/>
    <path d="M0 220 Q60 200 100 220 T180 220 T260 220 T340 220 T400 210" stroke="#c71585" stroke-width="2" fill="none" opacity="0.3" stroke-dasharray="8,4"/>
</svg>`;

/**
 * Open preview modal with rendered image
 */
function openPreview() {
    if (!currentImage) return;
    
    renderMergedImage(modalCanvas, 'modal').then(() => {
        previewModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        modalZoom = 100;
        modalZoomSlider.value = 100;
        modalCanvas.style.transform = 'scale(1)';
    });
}

/**
 * Close preview modal
 */
function closePreview() {
    previewModal.classList.add('hidden');
    document.body.style.overflow = '';
}

/**
 * Render merged image (user photo + SVG overlay)
 */
async function renderMergedImage(canvas, context = 'preview') {
    return new Promise((resolve) => {
        const size = 400; // Output size
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#fff1ea';
        ctx.fillRect(0, 0, size, size);
        
        // Draw user image
        if (currentImage) {
            const scale = currentZoom / 100;
            const scaledWidth = size / scale;
            const scaledHeight = size / scale;
            const x = (size - scaledWidth) / 2 + imageOffset.x;
            const y = (size - scaledHeight) / 2 + imageOffset.y;
            
            ctx.drawImage(currentImage, x, y, scaledWidth, scaledHeight);
        }
        
        // Draw SVG overlay
        const img = new Image();
        const svgBlob = new Blob([svgFrameContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = () => {
            ctx.drawImage(img, 0, 0, size, size);
            URL.revokeObjectURL(url);
            resolve();
        };
        
        img.src = url;
    });
}

/**
 * Download merged image
 */
async function downloadImage(context = 'download') {
    if (!currentImage) return;
    
    const button = context === 'download' ? btnDownload : modalDownload;
    const originalText = button.querySelector('span')?.textContent || button.textContent;
    
    // Show loading
    button.disabled = true;
    if (button.querySelector('span')) {
        button.querySelector('span').textContent = 'Đang xử lý...';
    }
    
    try {
        const canvas = context === 'download' ? processCanvas : modalCanvas;
        await renderMergedImage(canvas, context);
        
        // Convert to blob and download
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `birthday-frame-${inputAge.value || '18'}-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showToast('Tải ảnh thành công!', 'success');
        }, 'image/jpeg', 0.95);
    } catch (error) {
        console.error('Download error:', error);
        showToast('Có lỗi khi tải ảnh. Vui lòng thử lại.', 'error');
    } finally {
        button.disabled = false;
        if (button.querySelector('span')) {
            button.querySelector('span').textContent = originalText;
        }
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    // Remove existing toast
    if (showToastHandler) {
        clearTimeout(showToastHandler);
        document.querySelector('.toast')?.remove();
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto remove
    showToastHandler = setTimeout(() => {
        toast.remove();
    }, 3300);
}

// ===== Age input effect =====
inputAge.addEventListener('input', (e) => {
    const age = e.target.value.replace(/\D/g, '');
    e.target.value = age;
    
    // Could update frame SVG age text in real-time
    // For now, just show what's there
});

inputAge.addEventListener('blur', () => {
    if (currentImage) {
        updateImagePosition();
    }
});

// ===== Initialization =====
window.addEventListener('DOMContentLoaded', () => {
    // Check for URL parameters (optional sharing)
    const urlParams = new URLSearchParams(window.location.search);
    const sharedAge = urlParams.get('age');
    if (sharedAge) {
        inputAge.value = sharedAge;
    }
});

// ===== CSS-in-JS for dynamic styles (if needed) =====
function injectDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .toast + .toast {
            bottom: 80px;
        }
    `;
    document.head.appendChild(style);
}
injectDynamicStyles();

// Export for potential testing
window.birthdayApp = {
    handleFile,
    resetImage,
    downloadImage,
    openPreview,
    closePreview
};