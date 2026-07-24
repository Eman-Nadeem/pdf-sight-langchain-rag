import os
import uuid
from flask import Flask, render_template, request, jsonify, send_from_directory
from rag_engine import RagEngine

app=Flask(__name__)
app.secret_key="super-secret-key-change-in-production"

# Ensure upload directory exists
UPLOAD_FOLDER=os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER']=UPLOAD_FOLDER
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Initialie our RAG Engine instance
rag=RagEngine()

import threading

# Local DB directory to track uploaded documents
documents_db = {}

def sync_uploaded_files():
    """Scans uploads/ folder in background thread on startup so server boots instantly"""
    if not os.path.exists(UPLOAD_FOLDER):
        return

    files = [f for f in os.listdir(UPLOAD_FOLDER) if f.endswith('.pdf') and '_' in f]
    if not files:
        return

    def _bg_sync():
        # Process the most recently uploaded files first
        files.sort(key=lambda x: os.path.getmtime(os.path.join(UPLOAD_FOLDER, x)), reverse=True)
        for fname in files[:3]:
            parts = fname.split('_')
            doc_id = parts[0]
            original_filename = '_'.join(parts[1:])
            file_path = os.path.join(UPLOAD_FOLDER, fname)

            if doc_id not in documents_db:
                print(f"[+] Background syncing PDF: {original_filename} ({doc_id})...")
                chunks = rag.process_pdf(file_path, doc_id)
                if chunks > 0:
                    documents_db[doc_id] = {
                        "doc_id": doc_id,
                        "filename": original_filename,
                        "stored_filename": fname,
                        "chunks": chunks
                    }

    threading.Thread(target=_bg_sync, daemon=True).start()

sync_uploaded_files()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded in request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    # Create unique 8-character ID for document
    doc_id = str(uuid.uuid4())[:8]
    filename = file.filename
    stored_filename = f"{doc_id}_{filename}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], stored_filename)

    try:
        file.save(file_path)
        chunks_count = rag.process_pdf(file_path, doc_id)

        if chunks_count == 0:
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({"error": "No readable text chunks extracted from PDF. Please check if Ollama is running or if the PDF contains readable text."}), 400

        doc_meta = {
            "doc_id": doc_id,
            "filename": filename,
            "stored_filename": stored_filename,
            "chunks": chunks_count
        }
        documents_db[doc_id] = doc_meta

        return jsonify({
            "status": "success",
            "document": doc_meta
        })
    except Exception as e:
        print("Upload Error:", e)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        return jsonify({"error": f"Upload processing error: {str(e)}"}), 500

@app.route('/api/documents', methods=['GET'])
def get_documents():
    return jsonify(list(documents_db.values()))

@app.route('/api/documents/<doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    if doc_id not in documents_db:
        return jsonify({"error": "Document not found"}), 404

    doc_meta = documents_db.pop(doc_id)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], doc_meta["stored_filename"])
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print("Error deleting file from disk:", e)

    rag.delete_document(doc_id)
    return jsonify({"status": "success", "message": f"Document '{doc_meta['filename']}' deleted successfully."})

@app.route('/api/chat', methods=['POST'])
def chat():
    data=request.json or {}
    message=data.get("message")
    session_id=data.get("session_id", "default")
    doc_id=data.get("doc_id", "all")

    if not message:
        return jsonify({"error": "Message is required"}), 400

    response=rag.ask_pdf(message, session_id=session_id, doc_id=doc_id)
    return jsonify(response)

@app.route("/uploads/<path:filename>")
def serve_uploads(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__=="__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)


    