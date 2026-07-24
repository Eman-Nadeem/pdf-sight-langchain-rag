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
let activeHighlightSnippet = null;

/**
 * Loads a PDF document into PDF.js viewer
 */
function loadPDF(url, pageToJump = 1, snippet = null) {
    activeHighlightSnippet = snippet;
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

            // Highlight citation text snippet if provided
            if (activeHighlightSnippet) {
                drawTextHighlights(page, viewport, activeHighlightSnippet);
            }

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

    const pageNumElem = document.getElementById('pageNum');
    if (pageNumElem) pageNumElem.textContent = num;
    const pageNumInput = document.getElementById('pageNumInput');
    if (pageNumInput) pageNumInput.value = num;

    updateZoomDisplay();
}

const STOP_WORDS = new Set([
    'about', 'above', 'across', 'after', 'again', 'against', 'all', 'almost', 'alone', 'along',
    'already', 'also', 'although', 'always', 'among', 'an', 'and', 'another', 'any', 'anybody',
    'anyone', 'anything', 'anywhere', 'are', 'area', 'areas', 'around', 'as', 'ask', 'asked',
    'asking', 'asks', 'at', 'away', 'back', 'backed', 'backing', 'backs', 'be', 'became',
    'because', 'become', 'becomes', 'been', 'before', 'began', 'behind', 'being', 'beings',
    'best', 'better', 'between', 'both', 'but', 'by', 'came', 'can', 'cannot', 'case', 'cases',
    'certain', 'certainly', 'clear', 'clearly', 'come', 'could', 'did', 'differ', 'different',
    'differently', 'do', 'does', 'done', 'down', 'downed', 'downing', 'downs', 'during', 'each',
    'early', 'either', 'end', 'ended', 'ending', 'ends', 'enough', 'even', 'evenly', 'ever',
    'every', 'everybody', 'everyone', 'everything', 'everywhere', 'face', 'faces', 'fact',
    'facts', 'far', 'felt', 'few', 'find', 'finds', 'first', 'for', 'four', 'from', 'full',
    'fully', 'further', 'furthered', 'furthering', 'furthers', 'gave', 'general', 'generally',
    'get', 'gets', 'give', 'given', 'gives', 'go', 'going', 'good', 'goods', 'got', 'great',
    'greater', 'greatest', 'group', 'grouped', 'grouping', 'groups', 'had', 'has', 'have',
    'having', 'he', 'her', 'here', 'herself', 'high', 'higher', 'highest', 'him', 'himself',
    'his', 'how', 'however', 'if', 'important', 'in', 'into', 'is', 'it', 'its', 'itself',
    'just', 'keep', 'keeps', 'kind', 'knew', 'know', 'known', 'knows', 'large', 'largely',
    'last', 'later', 'latest', 'least', 'less', 'let', 'lets', 'like', 'likely', 'long',
    'longer', 'longest', 'made', 'make', 'making', 'man', 'many', 'may', 'me', 'member',
    'members', 'men', 'might', 'more', 'most', 'mostly', 'mr', 'mrs', 'much', 'must', 'my',
    'myself', 'necessary', 'need', 'needed', 'needing', 'needs', 'never', 'new', 'newer',
    'newest', 'next', 'no', 'nobody', 'non', 'noone', 'not', 'nothing', 'now', 'nowhere',
    'number', 'numbers', 'of', 'off', 'often', 'old', 'older', 'oldest', 'on', 'once', 'one',
    'only', 'open', 'opened', 'opening', 'opens', 'or', 'order', 'ordered', 'ordering',
    'orders', 'other', 'others', 'our', 'out', 'over', 'part', 'parted', 'parting', 'parts',
    'per', 'place', 'places', 'point', 'pointed', 'pointing', 'points', 'possible', 'present',
    'presented', 'presenting', 'presents', 'problem', 'problems', 'put', 'puts', 'quite',
    'rather', 'really', 'right', 'room', 'rooms', 'said', 'same', 'saw', 'say', 'says', 'second',
    'seconds', 'see', 'seem', 'seemed', 'seeming', 'seems', 'sees', 'several', 'shall', 'she',
    'should', 'show', 'showed', 'showing', 'shows', 'side', 'sides', 'since', 'small', 'smaller',
    'smallest', 'so', 'some', 'somebody', 'someone', 'something', 'somewhere', 'state', 'states',
    'still', 'such', 'sure', 'take', 'taken', 'than', 'that', 'the', 'their', 'them', 'then',
    'there', 'therefore', 'these', 'they', 'thing', 'things', 'think', 'thinks', 'this', 'those',
    'though', 'thought', 'thoughts', 'three', 'through', 'thus', 'to', 'today', 'together',
    'too', 'took', 'toward', 'turn', 'turned', 'turning', 'turns', 'two', 'under', 'until',
    'up', 'upon', 'us', 'use', 'used', 'uses', 'very', 'want', 'wanted', 'wanting', 'wants',
    'was', 'way', 'ways', 'we', 'well', 'wells', 'went', 'were', 'what', 'when', 'where',
    'whether', 'which', 'while', 'who', 'whole', 'whose', 'why', 'will', 'with', 'within',
    'without', 'work', 'worked', 'working', 'works', 'would', 'year', 'years', 'yet', 'you',
    'your', 'yours'
]);

/**
 * Searches page text content and draws translucent yellow highlights over matching citation keywords
 */
function drawTextHighlights(page, viewport, snippetText) {
    if (!snippetText) return;
    const cleanSnippet = snippetText.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').trim();
    if (!cleanSnippet) return;

    // Filter terms: length >= 5 and NOT a stop word
    const terms = cleanSnippet
        .split(/\s+/)
        .filter(w => w.length >= 5 && !STOP_WORDS.has(w));

    if (terms.length === 0) return;

    page.getTextContent().then(function(textContent) {
        ctx.fillStyle = 'rgba(255, 235, 59, 0.45)';
        ctx.strokeStyle = 'rgba(255, 152, 0, 0.85)';
        ctx.lineWidth = 1.5;

        textContent.items.forEach(function(item) {
            if (!item.str || !item.str.trim()) return;
            const itemText = item.str.toLowerCase().trim();
            if (itemText.length < 4) return;

            // Highlight only if item text contains a specific long technical keyword
            const isMatch = terms.some(term => itemText.includes(term) && term.length >= 5);

            if (isMatch && item.transform) {
                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const fontHeight = Math.hypot(tx[2], tx[3]) || (item.height * scale) || 14;
                const x = tx[4];
                const y = tx[5] - fontHeight;
                const width = (item.width * viewport.scale) || (item.str.length * fontHeight * 0.5);
                const height = fontHeight * 1.15;

                ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
                ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
            }
        });
    });
}

/**
 * Jump directly to a page (triggered by citation badges)
 */
function jumpToPage(num, snippet = null) {
    if (!pdfDoc) return;
    activeHighlightSnippet = snippet;
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

// Button & Input Controls (Clears citation highlight on manual navigation)
document.getElementById('prevPage').addEventListener('click', function() {
    if (pageNum <= 1) return;
    activeHighlightSnippet = null;
    pageNum--;
    queueRenderPage(pageNum);
});

document.getElementById('nextPage').addEventListener('click', function() {
    if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
    activeHighlightSnippet = null;
    pageNum++;
    queueRenderPage(pageNum);
});

// Interactive Page Number Input
const pageNumInput = document.getElementById('pageNumInput');
if (pageNumInput) {
    const triggerPageJump = () => {
        const val = parseInt(pageNumInput.value, 10);
        if (!isNaN(val) && val >= 1) {
            jumpToPage(val);
        }
    };
    pageNumInput.addEventListener('change', triggerPageJump);
    pageNumInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            triggerPageJump();
            pageNumInput.blur();
        }
    });
}

// Night Mode Inversion Toggle
const toggleNightModeBtn = document.getElementById('toggleNightModeBtn');
if (toggleNightModeBtn) {
    toggleNightModeBtn.addEventListener('click', function() {
        const pdfViewport = document.getElementById('pdfViewport');
        if (!pdfViewport) return;

        pdfViewport.classList.toggle('dark-mode');
        const isDark = pdfViewport.classList.contains('dark-mode');
        toggleNightModeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        toggleNightModeBtn.title = isDark ? 'Disable Night Mode' : 'Enable Night Mode';
    });
}

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
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.pdf-placeholder')) return;

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