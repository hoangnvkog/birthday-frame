/**
 * Birthday Frame App
 * Handles: Upload, Preview, Canvas Rendering, Zoom/Pan, Download
 */

// ===== DOM Elements =====
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const userImage = document.getElementById('userImage');
const placeholder = document.getElementById('placeholder');
const imageLayer = document.getElementById('imageLayer');
const frameOverlay = document.getElementById('frameOverlay');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFile');
const ageInput = document.getElementById('ageInput');
const viewBtn = document.getElementById('viewBtn');
const downloadBtn = document.getElementById('downloadBtn');
const zoomControls = document.getElementById('zoomControls');
const zoomSlider = document.getElementById('zoomSlider');
const zoomIn = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');
const previewModal = document.getElementById('previewModal');
const modalCanvas = document.getElementById('modalCanvas');
const closeModal = document.getElementById('closeModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalZoomSlider = document.getElementById('modalZoomSlider');
const modalZoomIn = document.getElementById('modalZoomIn');
const modalZoomOut = document.getElementById('modalZoomOut');
const modalDownload = document.getElementById('modalDownload');
const toast = document.getElementById('toast');
const canvas = document.getElementById('canvasLayer');

// ===== State =====
let uploadedFile = null;
let imageData = null;
let zoomLevel = 100;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX, startY;
let imgSrc = null;

// ===== Event Listeners =====
fileInput.addEventListener('change', handleFileSelect);
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
dropZone.addEventListener('click', () => fileInput.click());
removeFileBtn.addEventListener('click', removeFile);
viewBtn.addEventListener('click', openPreview);
downloadBtn.addEventListener('click', downloadImage);
closeModal.addEventListener('click', closePreviewModal);
modalOverlay.addEventListener('click', closePreviewModal);
modalDownload.addEventListener('click', () => downloadFinalImage(modalCanvas));

zoomSlider.addEventListener('input', handleZoom);
zoomIn.addEventListener('click', () => adjustZoom(10));
zoomOut.addEventListener('click', () => adjustZoom(-10));
modalZoomSlider.addEventListener('input', handleModalZoom);
modalZoomIn.addEventListener('click', () => adjustModalZoom(10));
modalZoomOut.addEventListener('click', () => adjustModalZoom(-10));

ageInput.addEventListener('input', updateAgeText);

// Touch events for panning
imageLayer.addEventListener('mousedown', handleMouseDown);
imageLayer.addEventListener('mousemove', handleMouseMove);
imageLayer.addEventListener('mouseup', handleMouseUp);
imageLayer.addEventListener('mouseleave', handleMouseUp);
imageLayer.addEventListener('touchstart', handleTouchStart, { passive: false });
imageLayer.addEventListener('touchmove', handleTouchMove, { passive: false });
imageLayer.addEventListener('touchend', handleTouchEnd);

// ===== File Upload Handlers =====
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && isImageFile(file)) {
        processFile(file);
    } else {
        showToast('Vui lòng chọn file ảnh (PNG, JPG, GIF)', 'error');
    }
}

function isImageFile(file) {
    return file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/gif');
}

function processFile(file) {
    if (file.size > 10 * 1024 * 1024) {
        showToast('File ảnh phải nhỏ hơn 10MB', 'error');
        return;
    }
    
    uploadedFile = file;
    
    // Show file info
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    filePreview.classList.remove('hidden');
    
    // Read file
    const reader = new FileReader();
    reader.onload = (e) => {
        imgSrc = e.target.result;
        userImage.src = imgSrc;
        userImage.classList.remove('hidden');
        userImage.onload = () => {
            updateCanvas();
            showPreview();
        };
    };
    reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile() {
    uploadedFile = null;
    imgSrc = null;
    fileInput.value = '';
    filePreview.classList.add('hidden');
    userImage.src = '';
    userImage.classList.add('hidden');
    placeholder.classList.remove('hidden');
    viewBtn.disabled = true;
    downloadBtn.disabled = true;
    zoomControls.classList.add('hidden');
    showToast('Đã xóa ảnh', 'success');
}

// ===== Preview & Canvas =====
function showPreview() {
    placeholder.classList.add('hidden');
    userImage.classList.remove('hidden');
    viewBtn.disabled = false;
    downloadBtn.disabled = false;
    zoomControls.classList.remove('hidden');
}

function updateCanvas() {
    if (!imgSrc) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        canvas.width = 400;
        canvas.height = 400;
        
        // Calculate cover fit
        const scale = Math.max(400 / img.width, 400 / img.height);
        const x = (400 - img.width * scale) / 2;
        const y = (400 - img.height * scale) / 2;
        
        ctx.clearRect(0, 0, 400, 400);
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    };
    img.src = imgSrc;
}

// ===== Zoom & Pan =====
function handleZoom(e) {
    zoomLevel = parseInt(e.target.value);
    applyZoom();
}

function adjustZoom(delta) {
    zoomLevel = Math.max(50, Math.min(200, zoomLevel + delta));
    zoomSlider.value = zoomLevel;
    applyZoom();
}

function applyZoom() {
    if (!userImage.src) return;
    const scale = zoomLevel / 100;
    userImage.style.transform = `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`;
    updateCanvasWithZoom();
}

function updateCanvasWithZoom() {
    if (!imgSrc) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        canvas.width = 400;
        canvas.height = 400;
        
        const scale = zoomLevel / 100;
        ctx.save();
        ctx.scale(scale, scale);
        ctx.translate(offsetX, offsetY);
        
        const coverScale = Math.max(400 / img.width, 400 / img.height);
        const x = (400 - img.width * coverScale) / 2;
        const y = (400 - img.height * coverScale) / 2;
        
        ctx.drawImage(img, x, y, img.width * coverScale, img.height * coverScale);
        ctx.restore();
    };
    img.src = imgSrc;
}

// ===== Drag/Pan =====
function handleMouseDown(e) {
    if (zoomLevel <= 100) return;
    isDragging = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    imageLayer.style.cursor = 'grabbing';
}

function handleMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    applyZoom();
}

function handleMouseUp() {
    isDragging = false;
    imageLayer.style.cursor = 'grab';
}

function handleTouchStart(e) {
    if (zoomLevel <= 100) return;
    const touch = e.touches[0];
    isDragging = true;
    startX = touch.clientX - offsetX;
    startY = touch.clientY - offsetY;
}

function handleTouchMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    offsetX = touch.clientX - startX;
    offsetY = touch.clientY - startY;
    applyZoom();
}

function handleTouchEnd() {
    isDragging = false;
}

// ===== Modal & Preview =====
function openPreview() {
    if (!imgSrc) return;
    renderFinalCanvas(modalCanvas);
    previewModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePreviewModal() {
    previewModal.classList.add('hidden');
    document.body.style.overflow = '';
}

function renderFinalCanvas(targetCanvas) {
    const ctx = targetCanvas.getContext('2d');
    const size = 400;
    targetCanvas.width = size;
    targetCanvas.height = size;
    
    // Fill background
    ctx.fillStyle = '#fff5ee';
    ctx.fillRect(0, 0, size, size);
    
    // Draw user image
    if (imgSrc) {
        const img = new Image();
        img.onload = () => {
            const scale = Math.max(size / img.width, size / img.height);
            const x = (size - img.width * scale) / 2 + offsetX;
            const y = (size - img.height * scale) / 2 + offsetY;
            const zoomScale = zoomLevel / 100;
            
            ctx.save();
            ctx.translate(size/2, size/2);
            ctx.scale(zoomScale, zoomScale);
            ctx.translate(-size/2, -size/2);
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            ctx.restore();
            
            // After drawing image, draw frame overlay
            drawFrame(ctx, size);
        };
        img.onerror = () => {
            showToast('Lỗi vẽ ảnh', 'error');
        };
        img.src = imgSrc;
    } else {
        // If no image, just draw frame
        drawFrame(ctx, size);
    }
}

function drawFrame(ctx, size) {
    const frameImg = new Image();
    frameImg.onload = () => {
        ctx.drawImage(frameImg, 0, 0, size, size);
    };
    frameImg.onerror = () => {
        console.warn('Không thể tải frame SVG');
    };
    frameImg.src = 'bg-opt1.svg';
}

function handleModalZoom(e) {
    zoomLevel = parseInt(e.target.value);
    modalZoomSlider.value = zoomLevel;
    zoomSlider.value = zoomLevel;
    applyZoom();
    renderFinalCanvas(modalCanvas);
}

function adjustModalZoom(delta) {
    zoomLevel = Math.max(50, Math.min(200, zoomLevel + delta));
    modalZoomSlider.value = zoomLevel;
    zoomSlider.value = zoomLevel;
    applyZoom();
    renderFinalCanvas(modalCanvas);
}

// ===== Download =====
function downloadImage() {
    if (!imgSrc) return;
    
    const downloadCanvas = document.createElement('canvas');
    downloadCanvas.width = 1200;
    downloadCanvas.height = 1200;
    const ctx = downloadCanvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#fff5ee';
    ctx.fillRect(0, 0, 1200, 1200);
    
    // Draw user image with high quality
    if (imgSrc) {
        const img = new Image();
        img.onload = () => {
            const scale = Math.max(1200 / img.width, 1200 / img.height);
            const x = (1200 - img.width * scale) / 2 + offsetX * 3;
            const y = (1200 - img.height * scale) / 2 + offsetY * 3;
            const zoomScale = zoomLevel / 100;
            
            ctx.save();
            ctx.translate(1200/2, 1200/2);
            ctx.scale(zoomScale, zoomScale);
            ctx.translate(-1200/2, -1200/2);
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            ctx.restore();
            
            // After drawing image, draw frame overlay (high quality)
            drawFrameHQ(ctx, 1200);
        };
        img.onerror = () => {
            showToast('Lỗi vẽ ảnh tải xuống', 'error');
        };
        img.src = imgSrc;
    }
}

function drawFrameHQ(ctx, size) {
    const frameImg = new Image();
    frameImg.onload = () => {
        ctx.drawImage(frameImg, 0, 0, size, size);
        
        // Trigger download after frame is drawn
        const link = document.createElement('a');
        link.download = `birthday-frame-${Date.now()}.png`;
        link.href = downloadCanvas.toDataURL('image/png');
        link.click();
        showToast('Đã tải ảnh thành công!', 'success');
    };
    frameImg.onerror = () => {
        console.warn('Không thể tải frame SVG cho download');
        // Download without frame if frame fails
        const link = document.createElement('a');
        link.download = `birthday-frame-${Date.now()}.png`;
        link.href = downloadCanvas.toDataURL('image/png');
        link.click();
        showToast('Đã tải ảnh (không có frame)', 'success');
    };
    frameImg.src = 'bg-opt1.svg';
}

function downloadFinalImage(canvas) {
    const link = document.createElement('a');
    link.download = `birthday-frame-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Đã tải ảnh thành công!', 'success');
}

function downloadFinalImage(canvas) {
    if (!imgSrc) return;
    
    const link = document.createElement('a');
    link.download = `birthday-frame-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Đã tải ảnh thành công!', 'success');
}

// ===== Frame Overlay =====
function updateAgeText() {
    // Could update SVG text dynamically, but for now we keep it static
    // Future: dynamic age in frame
}

// ===== Toast =====
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// ===== Keyboard shortcuts =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePreviewModal();
    }
});

// ===== Initialize =====
showToast('Chào mừng! Hãy tải ảnh của bạn lên.', 'success');