# Project Specification: Local Multi-PDF AI Assistant with PDF.js & Conversation Memory

## 1. Project Overview & Vision
This project is a privacy-first, fully local RAG (Retrieval-Augmented Generation) web application built using **Flask**, **LangChain**, **Ollama**, and **FAISS**.

It features a split-screen dashboard designed for deep document analysis:
- **Left Panel (ChatGPT/Gemini Interface):** A responsive chat screen supporting multi-turn conversation memory, Markdown formatting, document management (uploading/selecting multiple PDFs), and interactive citation badges.
- **Right Panel (PDF.js Interactive Viewer):** A full PDF viewer integrated via PDF.js. Clicking any citation badge in the chat dynamically navigates the viewer to the exact page and visually highlights the matching snippet.

---

## 2. Tech Stack & Environment

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Backend Framework** | Flask (Python) | REST API, SSE Streaming, Session State & File Handling |
| **Orchestration** | LangChain / LCEL | RAG pipelines, VectorStore management, Chat History |
| **Local LLM** | Ollama (`llama3.2`) | Local generation, multi-turn reasoning, context synthesis |
| **Local Embeddings** | Ollama (`nomic-embed-text`) | Vector representations of PDF chunks |
| **Vector Database** | FAISS | In-memory similarity search across multiple indexed PDFs |
| **Document Loader** | `pypdf` / `PyPDFLoader` | Extracting text, page numbers, and structural metadata |
| **Frontend Viewer** | PDF.js (Mozilla) | Interactive PDF rendering with programmatic page scrolling & text highlighting |

---

## 3. Key Feature Specifications

### 1. Multi-Document Indexing & Selection
- Users can upload multiple PDF files during a session.
- Each document is assigned a unique `doc_id`.
- The user can select a specific document to chat with, or choose **"All Documents"** to run RAG queries across the entire corpus stored in FAISS.

### 2. Full PDF.js Integration (Right Panel)
- Loads the active PDF directly in the browser using PDF.js.
- Supports smooth page navigation, zoom, and text layer rendering.
- When a user clicks a citation badge (e.g., `[Doc A - Page 12]`) in the chat:
  1. The PDF viewer switches to the target document if necessary.
  2. The viewer jumps automatically to Page 12.
  3. The target text snippet is highlighted on the canvas layer.

### 3. Multi-Turn Conversation Memory
- Leverages LangChain's `RunnableWithMessageHistory` (or `ChatMessageHistory`) to preserve conversational context across queries.
- Users can ask follow-up questions naturally (e.g., *"Can you summarize the second point you just mentioned?"*).
- System passes both conversation history and retrieved context chunks into `llama3.2`.

---

## 4. System Architecture & Directory Structure

```text
flask-rag-pdfjs/
├── app.py                     # Flask server (API routes, session management)
├── rag_engine.py              # LangChain RAG pipeline, FAISS manager, Memory handler
├── requirements.txt           # Python dependencies
├── PROJECT_CONTEXT.md         # Full project specification for AI agents/devs
│
├── uploads/                   # Folder for saving uploaded PDF files
│
├── static/
│   ├── css/
│   │   └── style.css          # Split-screen 50/50 dashboard styling
│   ├── js/
│   │   ├── chat.js            # Chat UI logic, SSE streaming, message history
│   │   └── pdf_viewer.js      # PDF.js controller, page jumping, text highlighting
│   └── vendor/
│       └── pdfjs/             # Downloaded PDF.js library files (build + web)
│
└── templates/
    └── index.html             # Split view container (Chat on left, PDF on right)