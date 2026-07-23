// PDF.js worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.2;
const canvas = document.getElementById('pdfCanvas');
const ctx = canvas.getContext('2d');

/**
 * Loads a PDF document into PDF.js viewer
 */
function loadPDF(url, pageToJump = 1) {
    document.getElementById('pdfPlaceholder').classList.add('hidden');
    const canvasWrapper = document.getElementById('canvasWrapper');
    if (canvasWrapper) canvasWrapper.classList.remove('hidden');
    canvas.classList.remove('hidden');

    pdfjsLib.getDocument(url).promise.then(function(pdfDoc_) {
        pdfDoc = pdfDoc_;
        document.getElementById('pageCount').textContent = pdfDoc.numPages;

        // Render target page
        pageNum = Math.min(Math.max(1, pageToJump), pdfDoc.numPages);
        renderPage(pageNum);
    }).catch(function(error) {
        console.error('Error loading PDF:', error);
        alert('Could not load PDF document.');
    });
}

let currentRenderTask = null;

/**
 * Renders a specific page number onto the canvas
 */
function renderPage(num) {
    // If a rendering task is in progress, cancel it before starting a new one
    if (pageRendering && currentRenderTask) {
        currentRenderTask.cancel();
    }
    pageRendering = true;

    pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        currentRenderTask = page.render(renderContext);

        currentRenderTask.promise.then(function() {
            pageRendering = false;
            currentRenderTask = null;

            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        }).catch(function(error) {
            // Ignore cancelled render tasks gracefully
            if (error && error.name === 'RenderingCancelledException') {
                pageRendering = false;
                currentRenderTask = null;
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
            } else {
                console.error('Error rendering page:', error);
                pageRendering = false;
                currentRenderTask = null;
            }
        });
    });

    document.getElementById('pageNum').textContent = num;
    updateZoomDisplay();
}

/**
 * Jump directly to a page (triggered by citation badges)
 */
function jumpToPage(num) {
    if (!pdfDoc) return;
    const targetPage = Math.min(Math.max(1, num), pdfDoc.numPages);
    pageNum = targetPage;
    queueRenderPage(targetPage);
}

/**
 * Queue page rendering if currently busy
 */
function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

function updateZoomDisplay() {
    const zoomScaleElem = document.getElementById('zoomScale');
    if (zoomScaleElem) {
        zoomScaleElem.textContent = Math.round(scale * 100) + '%';
    }
}

// Button Controls
document.getElementById('prevPage').addEventListener('click', function() {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
});

document.getElementById('nextPage').addEventListener('click', function() {
    if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
});

document.getElementById('zoomIn').addEventListener('click', function() {
    if (scale >= 5.0) return;
    scale = Math.min(5.0, Math.round((scale + 0.2) * 100) / 100);
    updateZoomDisplay();
    if (pdfDoc) renderPage(pageNum);
});

document.getElementById('zoomOut').addEventListener('click', function() {
    if (scale <= 0.4) return;
    scale = Math.max(0.4, Math.round((scale - 0.2) * 100) / 100);
    updateZoomDisplay();
    if (pdfDoc) renderPage(pageNum);
});

const zoomResetBtn = document.getElementById('zoomReset');
if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', function() {
        scale = 1.2;
        updateZoomDisplay();
        if (pdfDoc) renderPage(pageNum);
    });
}

// ==========================================
// DRAG VIEW / CLICK-AND-DRAG PANNING ON PDF
// ==========================================
const pdfViewport = document.getElementById('pdfViewport');
let isPanning = false;
let startX = 0, startY = 0;
let initialScrollLeft = 0, initialScrollTop = 0;

if (pdfViewport) {
    pdfViewport.addEventListener('mousedown', function(e) {
        // Prevent panning when clicking buttons or controls
        if (e.target.closest('button') || e.target.closest('.pdf-placeholder')) return;
        
        isPanning = true;
        pdfViewport.classList.add('grabbing');
        startX = e.clientX;
        startY = e.clientY;
        initialScrollLeft = pdfViewport.scrollLeft;
        initialScrollTop = pdfViewport.scrollTop;
    });

    document.addEventListener('mousemove', function(e) {
        if (!isPanning) return;
        e.preventDefault();
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        pdfViewport.scrollLeft = initialScrollLeft - deltaX;
        pdfViewport.scrollTop = initialScrollTop - deltaY;
    });

    document.addEventListener('mouseup', function() {
        if (isPanning) {
            isPanning = false;
            pdfViewport.classList.remove('grabbing');
        }
    });
}