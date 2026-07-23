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

/**
 * Renders a specific page number onto the canvas
 */
function renderPage(num) {
    pageRendering = true;

    pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        const renderTask = page.render(renderContext);

        renderTask.promise.then(function() {
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });

    document.getElementById('pageNum').textContent = num;
}

/**
 * Jump directly to a page (triggered by citation badges)
 */
function jumpToPage(num) {
    if (!pdfDoc) return;
    const targetPage = Math.min(Math.max(1, num), pdfDoc.numPages);
    pageNum = targetPage;
    if (pageRendering) {
        pageNumPending = targetPage;
    } else {
        renderPage(targetPage);
    }
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
    if (scale >= 2.5) return;
    scale += 0.2;
    if (pdfDoc) renderPage(pageNum);
});

document.getElementById('zoomOut').addEventListener('click', function() {
    if (scale <= 0.6) return;
    scale -= 0.2;
    if (pdfDoc) renderPage(pageNum);
});