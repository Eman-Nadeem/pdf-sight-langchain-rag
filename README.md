# 🧠 PDF-Sight — Local Multi-PDF RAG Assistant

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Backend-Flask-green.svg)](https://flask.palletsprojects.com/)
[![LangChain](https://img.shields.io/badge/Framework-LangChain-orange.svg)](https://www.langchain.com/)
[![FAISS](https://img.shields.io/badge/VectorDB-FAISS-blueviolet.svg)](https://github.com/facebookresearch/faiss)
[![Ollama](https://img.shields.io/badge/Local--AI-Ollama-black.svg)](https://ollama.ai/)
[![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)

**PDF-Sight** is a privacy-first, local multi-document Retrieval-Augmented Generation (RAG) assistant. Built with **Flask**, **LangChain**, **FAISS**, **PDF.js**, and **Ollama**, PDF-Sight turns your local PDF library into an interactive, conversational knowledge base with interactive page-level citation badges and an interactive PDF viewer.

---

## 🌟 Features & Highlights

### ⚡ Smart Document Intelligence & RAG
- **Multi-PDF Library Indexing**: Upload and index multiple PDF files simultaneously into a high-density FAISS vector store.
- **Target Context Filtering**: Switch search scoping between `🌐 All Indexed Documents` or target specific files.
- **Interactive Citation Badges**: Click any citation badge in the AI responses to switch the viewer and jump to the exact source page.
- **Local & Private**: Powered by **Ollama** (`llama3.2` & `nomic-embed-text`) — no API keys required and 100% of your data stays on your machine.

### 🎨 Commercial-Grade UI / UX
- **Draggable Split-Panel Resizer**: Drag the central divider bar to adjust chat and PDF viewer panel widths in real-time.
- **Collapsible Sidebar**: One-click toggle to collapse the chat panel into a full-screen 100% width PDF viewer.
- **High-Resolution PDF.js Viewer**: Multi-page rendering with page controls, zoom scaling up to 500%, live zoom percentage display, and 1-click zoom reset.
- **Bi-Directional Drag-to-Pan (Grab View)**: Click and drag anywhere on zoomed-in PDF pages (`cursor: grab / grabbing`) to navigate pages without edge clipping.
- **Safe Center Layout Engine**: Automatically centers pages when fitted, and preserves equal 4-side dark margins during zoom overflow.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend Framework** | [Flask](https://flask.palletsprojects.com/) | REST API routes for uploads, document management, and RAG chat streams |
| **RAG Orchestration** | [LangChain](https://www.langchain.com/) | Document loading (`PyPDFLoader`), chunking (`RecursiveCharacterTextSplitter`), and prompt chaining |
| **Vector Database** | [FAISS](https://github.com/facebookresearch/faiss) | High-performance in-memory similarity search and embedding storage |
| **Local LLM & Embeddings** | [Ollama](https://ollama.ai/) | `llama3.2` (Chat LLM) & `nomic-embed-text` (Document Vector Embeddings) |
| **Frontend Viewer** | [PDF.js](https://mozilla.github.io/pdf.js/) | Hardware-accelerated HTML5 canvas rendering for PDF documents |
| **Styling & Logic** | HTML5, Vanilla CSS3, JavaScript (ES6+) | Resizable split layout, draggable handle, collapsible sidebar, and responsive styling |

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    User([User]) -->|Upload PDF| Flask[Flask Backend /api/upload]
    Flask --> Loader[PyPDFLoader & TextSplitter]
    Loader --> Embedder[Ollama nomic-embed-text]
    Embedder --> FAISS[(FAISS Vector Store)]

    User -->|Ask Question| Chat[Flask Backend /api/chat]
    Chat --> Retriever[FAISS Retriever Scoped by Doc ID]
    Retriever --> Prompt[LangChain Context Prompt]
    Prompt --> LLM[Ollama llama3.2 LLM]
    LLM --> Answer[AI Answer + Citation Page Metadata]
    Answer --> UI[PDF-Sight GUI / PDF.js Canvas]
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Python**: Version `3.10` or higher installed.
- **Ollama**: Download and install [Ollama](https://ollama.ai/).

Pull the required local LLM and embedding models:
```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

---

### 2. Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YourUsername/pdf-sight.git
   cd pdf-sight
   ```

2. **Create and activate a Python virtual environment**:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Create a `.env` file in the root directory (or use the included defaults):
   ```env
   # Model Provider: "ollama", "openai", or "gemini"
   MODEL_PROVIDER=ollama

   # Local Ollama Configuration
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   OLLAMA_EMBED_MODEL=nomic-embed-text

   # Cloud Providers (Optional)
   OPENAI_API_KEY=your-openai-api-key-here
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_EMBED_MODEL=text-embedding-3-small

   GOOGLE_API_KEY=your-google-gemini-api-key-here
   GEMINI_MODEL=gemini-1.5-flash
   ```

---

### 3. Running the Application

Launch the Flask server:
```bash
python app.py
```

Open your browser and navigate to:
```text
http://127.0.0.1:5000
```

---

## 📁 Directory Structure

```text
pdf-sight/
├── app.py                  # Flask server application & API routes
├── rag_engine.py           # LangChain RAG pipeline & FAISS integration
├── requirements.txt        # Python package dependencies
├── .env                    # Environment configuration file
├── uploads/                # Uploaded PDF document storage
├── static/
│   ├── css/
│   │   └── style.css       # Design tokens, resizer bar, & PDF viewer layout
│   └── js/
│       ├── chat.js         # Chat UI, upload handler, resizer & sidebar logic
│       └── pdf_viewer.js   # PDF.js render pipeline, zoom controls & panning
└── templates/
    └── index.html          # Main split-panel application view
```

---

## ⚡ Switching Model Providers

PDF-Sight natively supports switching between local Ollama and cloud providers like OpenAI or Google Gemini.

To switch providers, update your `.env` file:
```env
# Switch to OpenAI
MODEL_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Or Switch to Gemini
MODEL_PROVIDER=gemini
GOOGLE_API_KEY=AIzaSy...
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git checkout -b feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
