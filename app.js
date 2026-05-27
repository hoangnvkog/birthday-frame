/**
 * Birthday Frame App v2.0
 * Handles: Upload, Preview, Canvas Rendering, Zoom/Pan, Download with Frame Overlay
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
let zoomLevel = 100;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX, startY;
let imgSrc = null;
let frameSvgBlobUrl = null;
let isFrameReady = false;
let currentFrameUrl = null;
let frameSvgRaw = null; // raw SVG text for dynamic age replacement

// ===== Load Frame SVG via Fetch =====
async function loadFrameSvg() {
    try {
        const response = await fetch('bg-opt1.svg');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        frameSvgRaw = await response.text();
        
        // Create initial Blob from SVG text
        const blob = new Blob([frameSvgRaw], { type: 'image/svg+xml' });
        frameSvgBlobUrl = URL.createObjectURL(blob);
        isFrameReady = true;
        
        console.log('✅ Frame SVG loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load frame SVG:', error);
        showToast('Không thể tải frame overlay', 'error');
    }
}

// ===== Replace age in SVG text =====
function getSvgWithAge(age) {
    if (!frameSvgRaw) return frameSvgRaw;
    // Replace content of any tspan with class="text-age"
    return frameSvgRaw.replace(/class="text-age"[^>]*>[^<]+<\/tspan>/g, function(match) {
        return match.replace(/>[^<]+<//, '>' + age + '</');
    });
}

// ===== Refresh the live frame preview thumbnail =====
function refreshFramePreview(age) {
    if (!isFrameReady || !frameSvgRaw) return;
    const previewImg = document.querySelector('.frame-svg-img');
    if (!previewImg) return;
    
    // Revoke old Blob URL to avoid memory leak
    if (previewImg._blobUrl) {
        URL.revokeObjectURL(previewImg._blobUrl);
    }
    
    const svgWithAge = getSvgWithAge(age);
    const blob = new Blob([svgWithAge], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    previewImg.src = url;
    previewImg._blobUrl = url;
}

// ===== Get a fresh frame Blob URL with current age =====
function getDynamicFrameBlobUrl() {
    if (!frameSvgRaw) return frameSvgBlobUrl;
    const age = ageInput.value || '18';
    const svgWithAge = getSvgWithAge(age);
    const blob = new Blob([svgWithAge], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
}

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
// Also update frame preview when age changes via blur/enter
ageInput.addEventListener('change', updateAgeText);

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
            updateCanvasWithZoom();
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

function updateCanvasWithZoom() {
    if (!imgSrc) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        canvas.width = 400;
        canvas.height = 400;
        
        // Calculate cover fit
        const coverScale = Math.max(400 / img.width, 400 / img.height);
        const x = (400 - img.width * coverScale) / 2 + offsetX;
        const y = (400 - img.height * coverScale) / 2 + offsetY;
        
        const zoomScale = zoomLevel / 100;
        
        ctx.save();
        ctx.translate(200, 200);
        ctx.scale(zoomScale, zoomScale);
        ctx.translate(-200, -200);
        ctx.drawImage(img, x, y, img.width * coverScale, img.height * coverScale);
        ctx.restore();
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
    modalZoomSlider.value = zoomLevel;
    applyZoom();
}

function applyZoom() {
    if (!userImage.src) return;
    const scale = zoomLevel / 100;
    userImage.style.transform = `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`;
    updateCanvasWithZoom();
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
            
            // Draw frame overlay AFTER image
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

// ===== Draw Frame using dynamic Blob URL (with age) =====
function drawFrame(ctx, size) {
    if (!isFrameReady || !frameSvgRaw) {
        console.warn('Frame SVG chưa được tải hoặc chưa sẵn sàng');
        return;
    }
    
    const dynamicUrl = getDynamicFrameBlobUrl();
    const frameImg = new Image();
    frameImg.onload = () => {
        ctx.drawImage(frameImg, 0, 0, size, size);
        URL.revokeObjectURL(dynamicUrl);
        console.log('✅ Frame drawn successfully');
    };
    frameImg.onerror = () => {
        console.warn('❌ Không thể vẽ frame SVG');
        URL.revokeObjectURL(dynamicUrl);
    };
    frameImg.src = dynamicUrl;
}

// ===== Modal Zoom =====
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
    if (!imgSrc) {
        showToast('Vui lòng tải ảnh trước', 'error');
        return;
    }
    
    if (!isFrameReady) {
        showToast('Frame đang được tải, vui lòng đợi...', 'error');
        return;
    }
    
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
            
            // Draw frame overlay (high quality)
            drawFrameHQ(ctx, 1200, downloadCanvas);
        };
        img.onerror = () => {
            showToast('Lỗi vẽ ảnh tải xuống', 'error');
        };
        img.src = imgSrc;
    }
}

function drawFrameHQ(ctx, size, targetCanvas) {
    if (!isFrameReady || !frameSvgRaw) {
        console.warn('Frame SVG chưa sẵn sàng cho download');
        return;
    }
    
    const dynamicUrl = getDynamicFrameBlobUrl();
    const frameImg = new Image();
    frameImg.onload = () => {
        ctx.drawImage(frameImg, 0, 0, size, size);
        URL.revokeObjectURL(dynamicUrl);
        
        // Trigger download after frame is drawn
        const link = document.createElement('a');
        link.download = `birthday-frame-${Date.now()}.png`;
        link.href = targetCanvas.toDataURL('image/png');
        link.click();
        showToast('Đã tải ảnh thành công!', 'success');
    };
    frameImg.onerror = () => {
        console.warn('❌ Không thể vẽ frame SVG cho download');
        URL.revokeObjectURL(dynamicUrl);
        // Download without frame
        const link = document.createElement('a');
        link.download = `birthday-frame-${Date.now()}.png`;
        link.href = targetCanvas.toDataURL('image/png');
        link.click();
        showToast('Đã tải ảnh (không có frame)', 'warning');
    };
    frameImg.src = dynamicUrl;
}

function downloadFinalImage(canvas) {
    const link = document.createElement('a');
    link.download = `birthday-frame-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Đã tải ảnh thành công!', 'success');
}

// ===== Age Text Update =====
function updateAgeText() {
    const age = ageInput.value || '18';
    console.log('Age updated to:', age);
    
    // Update the preview thumbnail with new age
    refreshFramePreview(age);
    
    // If image is loaded, refresh the thumbnail canvas
    if (imgSrc) {
        updateCanvasWithZoom();
    }
    
    // If modal is open, re-render it
    if (!previewModal.classList.contains('hidden')) {
        renderFinalCanvas(modalCanvas);
    }
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
document.addEventListener('DOMContentLoaded', () => {
    loadFrameSvg(); // Load frame SVG on startup
    showToast('Chào mừng! Hãy tải ảnh của bạn lên.', 'success');
});
