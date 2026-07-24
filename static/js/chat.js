// Generate a unique session ID for this browser tab
const sessionId = 'session_' + Math.random().toString(36).substring(2, 10);

// Map to store document metadata: { doc_id: { filename, stored_filename } }
const documentsMap = {};
let activeDocId = null;

// UI Elements
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const docSelect = document.getElementById('docSelect');
const uploadBtn = document.getElementById('uploadBtn');
const pdfFileInput = document.getElementById('pdfFileInput');
const activeDocTitle = document.getElementById('activeDocTitle');

// 1. PDF Upload Triggers
uploadBtn.addEventListener('click', () => pdfFileInput.click());

pdfFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Indexing...';

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.status === 'success') {
            const doc = data.document;
            documentsMap[doc.doc_id] = doc;

            // Add to dropdown selector
            const option = document.createElement('option');
            option.value = doc.doc_id;
            option.textContent = `📄 ${doc.filename}`;
            docSelect.appendChild(option);
            docSelect.value = doc.doc_id;

            // Automatically switch viewer to newly uploaded PDF
            switchActivePDF(doc.doc_id, 1);

            appendSystemMessage(`Successfully indexed <strong>${doc.filename}</strong> (${doc.chunks} vector chunks).`);
        } else {
            alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        console.error('Upload Error:', err);
        alert('An error occurred during PDF upload.');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload PDF';
        pdfFileInput.value = '';
    }
});

// 2. Document Selection Change
docSelect.addEventListener('change', (e) => {
    const selectedDocId = e.target.value;
    if (selectedDocId !== 'all' && documentsMap[selectedDocId]) {
        switchActivePDF(selectedDocId, 1);
    }
});

// 3. Switch Active PDF in Viewer
function switchActivePDF(docId, pageToJump = 1) {
    const doc = documentsMap[docId];
    if (!doc) return;

    activeDocId = docId;
    activeDocTitle.textContent = doc.filename;
    loadPDF(`/uploads/${doc.stored_filename}`, pageToJump);
}

// 4. Chat Submission Handler
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = userInput.value.trim();
    if (!query) return;

    // Append user message to chat UI
    appendUserMessage(query);
    userInput.value = '';

    // Show loading typing indicator
    const loadingId = appendLoadingMessage();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: query,
                session_id: sessionId,
                doc_id: docSelect.value
            })
        });

        const data = await response.json();
        removeMessage(loadingId);

        if (response.ok) {
            appendAIMessage(data.answer, data.sources);
        } else {
            appendAIMessage('Sorry, an error occurred: ' + (data.error || 'Failed to generate response.'));
        }
    } catch (err) {
        console.error('Chat Error:', err);
        removeMessage(loadingId);
        appendAIMessage('Could not connect to backend server.');
    }
});

// Helper Functions for Chat Rendering
function appendUserMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message user-message';
    msgDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-user"></i></div>
        <div class="content">${escapeHTML(text)}</div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

const citationsStore = {};

function appendAIMessage(answerText, sources = []) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message ai-message';

    let citationsHTML = '';
    if (sources && sources.length > 0) {
        citationsHTML = '<div class="citations-container">';
        sources.forEach(src => {
            const citeId = 'cite_' + Math.random().toString(36).substring(2, 10);
            citationsStore[citeId] = {
                doc_id: src.doc_id,
                page: src.page,
                snippet: src.snippet || ''
            };

            const docName = documentsMap[src.doc_id] ? documentsMap[src.doc_id].filename : `Doc ${src.doc_id}`;
            citationsHTML += `
                <button class="citation-badge" data-cite-id="${citeId}">
                    <i class="fa-solid fa-bookmark"></i> ${escapeHTML(docName)} (Page ${src.page})
                </button>
            `;
        });
        citationsHTML += '</div>';
    }

    msgDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="content">
            <div>${formatMarkdown(answerText)}</div>
            ${citationsHTML}
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

// Event Delegation for Citation Badge Clicks
chatMessages.addEventListener('click', (e) => {
    const badge = e.target.closest('.citation-badge');
    if (!badge) return;

    const citeId = badge.dataset.citeId;
    if (citeId && citationsStore[citeId]) {
        const cite = citationsStore[citeId];
        if (documentsMap[cite.doc_id]) {
            if (activeDocId !== cite.doc_id) {
                switchActivePDF(cite.doc_id, cite.page, cite.snippet);
            } else {
                jumpToPage(cite.page, cite.snippet);
            }
        }
    }
});

function appendSystemMessage(htmlText) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message system-message';
    msgDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-circle-info"></i></div>
        <div class="content">${htmlText}</div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

function appendLoadingMessage() {
    const id = 'msg_' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.id = id;
    msgDiv.className = 'message ai-message';
    msgDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="content"><i class="fa-solid fa-spinner fa-spin"></i> Thinking...</div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
    return id;
}

function removeMessage(id) {
    const elem = document.getElementById(id);
    if (elem) elem.remove();
}

async function loadExistingDocuments() {
    try {
        const res = await fetch('/api/documents');
        if (!res.ok) return;
        const docs = await res.json();

        docs.forEach(doc => {
            documentsMap[doc.doc_id] = doc;
            if (!docSelect.querySelector(`option[value="${doc.doc_id}"]`)) {
                const option = document.createElement('option');
                option.value = doc.doc_id;
                option.textContent = `📄 ${doc.filename}`;
                docSelect.appendChild(option);
            }
        });

        if (docs.length > 0 && !activeDocId) {
            const firstDoc = docs[0];
            docSelect.value = firstDoc.doc_id;
            switchActivePDF(firstDoc.doc_id, 1);
        }
    } catch (err) {
        console.error('Error loading initial documents:', err);
    }
}

document.addEventListener('DOMContentLoaded', loadExistingDocuments);

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function formatMarkdown(text) {
    // Basic formatting for linebreaks and bold text
    return escapeHTML(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

// ==========================================
// 5. COLLAPSIBLE SIDEBAR & DRAGGABLE RESIZER
// ==========================================
const chatPanel = document.getElementById('chatPanel');
const resizer = document.getElementById('resizer');
const toggleChatBtn = document.getElementById('toggleChatBtn');
const expandChatBtn = document.getElementById('expandChatBtn');
const resizerToggleBtn = document.getElementById('resizerToggleBtn');

let isDragging = false;

function collapseSidebar() {
    chatPanel.classList.add('collapsed');
    if (resizer) resizer.style.display = 'none';
    if (expandChatBtn) expandChatBtn.classList.remove('hidden');
}

function expandSidebar() {
    chatPanel.classList.remove('collapsed');
    if (resizer) resizer.style.display = 'flex';
    if (expandChatBtn) expandChatBtn.classList.add('hidden');
}

if (toggleChatBtn) toggleChatBtn.addEventListener('click', collapseSidebar);
if (expandChatBtn) expandChatBtn.addEventListener('click', expandSidebar);
if (resizerToggleBtn) {
    resizerToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (chatPanel.classList.contains('collapsed')) {
            expandSidebar();
        } else {
            collapseSidebar();
        }
    });
}

const pdfPanelElem = document.getElementById('pdfPanel');

function updatePdfPanelNarrowState() {
    if (!pdfPanelElem) return;
    if (pdfPanelElem.offsetWidth < 450) {
        pdfPanelElem.classList.add('narrow');
    } else {
        pdfPanelElem.classList.remove('narrow');
    }
}

// Draggable Resizer Handle
if (resizer && chatPanel) {
    resizer.addEventListener('mousedown', (e) => {
        if (e.target.closest('#resizerToggleBtn')) return;
        isDragging = true;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const minWidth = 320;
        const maxWidth = window.innerWidth * 0.7;
        let newWidth = e.clientX;

        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;

        chatPanel.style.width = `${newWidth}px`;
        updatePdfPanelNarrowState();
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    window.addEventListener('resize', updatePdfPanelNarrowState);
    updatePdfPanelNarrowState();
}

// ==========================================
// 6. EXPORT CHAT & ANALYSIS REPORT (.md)
// ==========================================
const exportReportBtn = document.getElementById('exportReportBtn');
if (exportReportBtn) {
    exportReportBtn.addEventListener('click', () => {
        const messages = chatMessages.querySelectorAll('.message');
        if (messages.length === 0) {
            alert('No conversation history to export.');
            return;
        }

        let reportText = `# 🧠 PDF-Sight Analysis & Chat Report\n`;
        reportText += `**Generated**: ${new Date().toLocaleString()}\n`;
        reportText += `**Target Context**: ${docSelect.options[docSelect.selectedIndex].text}\n\n`;
        reportText += `---\n\n## 💬 Conversation History\n\n`;

        messages.forEach((msg, idx) => {
            const isUser = msg.classList.contains('user-message');
            const isAI = msg.classList.contains('ai-message');
            const isSystem = msg.classList.contains('system-message');
            const contentDiv = msg.querySelector('.content');

            if (!contentDiv) return;

            if (isUser) {
                reportText += `### 👤 User:\n${contentDiv.innerText.trim()}\n\n`;
            } else if (isAI) {
                const textOnly = contentDiv.children[0] ? contentDiv.children[0].innerText.trim() : contentDiv.innerText.trim();
                reportText += `### 🤖 Assistant:\n${textOnly}\n\n`;

                const citations = msg.querySelectorAll('.citation-badge');
                if (citations.length > 0) {
                    reportText += `**Citations**:\n`;
                    citations.forEach(c => {
                        reportText += `- ${c.innerText.trim()}\n`;
                    });
                    reportText += `\n`;
                }
            } else if (isSystem) {
                reportText += `> ℹ️ *System*: ${contentDiv.innerText.trim()}\n\n`;
            }
        });

        reportText += `---\n*Report exported from PDF-Sight Local Multi-PDF RAG Assistant*\n`;

        const blob = new Blob([reportText], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PDF-Sight_Report_${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

// ==========================================
// 7. DOCUMENT MANAGER MODAL & DELETION
// ==========================================
const docManagerModal = document.getElementById('docManagerModal');
const openDocManagerBtn = document.getElementById('openDocManagerBtn');
const closeDocManagerBtn = document.getElementById('closeDocManagerBtn');
const docListContainer = document.getElementById('docListContainer');

function renderDocManagerList() {
    if (!docListContainer) return;
    const docs = Object.values(documentsMap);

    if (docs.length === 0) {
        docListContainer.innerHTML = '<p class="empty-state">No documents indexed yet. Upload a PDF to get started.</p>';
        return;
    }

    let html = '';
    docs.forEach(doc => {
        html += `
            <div class="doc-item">
                <div class="doc-item-info">
                    <div class="doc-item-title"><i class="fa-regular fa-file-pdf"></i> ${escapeHTML(doc.filename)}</div>
                    <div class="doc-item-meta">ID: ${doc.doc_id} • ${doc.chunks} vector chunks</div>
                </div>
                <button class="btn btn-danger" onclick="deleteDocumentFromManager('${doc.doc_id}')">
                    <i class="fa-solid fa-trash-can"></i> Delete
                </button>
            </div>
        `;
    });
    docListContainer.innerHTML = html;
}

if (openDocManagerBtn) {
    openDocManagerBtn.addEventListener('click', () => {
        renderDocManagerList();
        if (docManagerModal) docManagerModal.classList.remove('hidden');
    });
}

if (closeDocManagerBtn) {
    closeDocManagerBtn.addEventListener('click', () => {
        if (docManagerModal) docManagerModal.classList.add('hidden');
    });
}

if (docManagerModal) {
    docManagerModal.addEventListener('click', (e) => {
        if (e.target === docManagerModal) {
            docManagerModal.classList.add('hidden');
        }
    });
}

// Global handler for document deletion from modal
window.deleteDocumentFromManager = async function(docId) {
    const doc = documentsMap[docId];
    if (!doc) return;

    if (!confirm(`Are you sure you want to delete '${doc.filename}' from vector store?`)) return;

    try {
        const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok) {
            delete documentsMap[docId];

            // Remove option from docSelect dropdown
            const opt = docSelect.querySelector(`option[value="${docId}"]`);
            if (opt) opt.remove();

            if (docSelect.value === docId) docSelect.value = 'all';

            renderDocManagerList();
            appendSystemMessage(`Document <strong>${doc.filename}</strong> has been deleted.`);
        } else {
            alert('Delete failed: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert('An error occurred while deleting the document.');
    }
};