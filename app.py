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

# Initialie our RAG Engine instance
rag=RagEngine()

# Local DB directory to track uploaded documents
documents_db={}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No files found"}), 400
    
    file=request.files['file']
    if file.filename=='':
        return jsonify({"error": "No file selected"}), 400

    # Create unique 8-character ID for document
    doc_id=str(uuid.uuid4())[:8]
    filename=file.name
    stored_filename=f"{doc_id}_{filename}"
    file_path=os.path.join(app.config['UPLOAD_FOLDER'], stored_filename)
    file.save(file_path)

    chunk_count=rag.process_pdf(file_path, doc_id)

    doc_meta={
        "doc_id": doc_id,
        "filename": filename,
        "stored_filename": stored_filename,
        "chunks": chunks_count
    }
    documents_db[doc_id]=doc_meta

    return jsonify({
        "status":"success",
        "document":doc_meta
    })

@app.route('/api/documents', methods=['GET'])
def get_documents():
    return jsonify(list(documents_db.values()))

@app.route('/api/chat', methods=['POST'])
def chat():
    data=request.json or {}
    message=data.get("message")
    session_id=data.get("session_id", "default")
    doc_id=data.get("doc_id", "all")

    if not message:
        return jsonify({"error": "Message is required"}), 400

    reponse=rag.ask_pdf(message, session_id=session_id, doc_id=doc_id)
    return jsonify(response)

@app.route("/uploads/<path:filename>")
def serve_uploads(filename):
    return
send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__=="__main__":
    app.run(host="[IP_ADDRESS]", port=5000, debug=True)

    