import os
from dotenv import load_dotenv

# Document processing & Vector store
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS

# Local Ollama imports
from langchain_ollama import OllamaEmbeddings, ChatOllama

# (Optional Cloud Provider Imports - keep commented or handle conditionally)
# from langchain_openai import ChatOpenAI, OpenAIEmbeddings
# from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory

load_dotenv()

class RagEngine:
    def __init__(self):
        self.provider=os.getenv("MODEL_PROVIDER")
        self.vector_store=None
        self.init_models()
        self.sessions={}
        self.prompt=ChatPromptTemplate.from_messages([
            ("system", """You are a helpful AI document assistant. 
Answer the user's question accurately using ONLY the context provided below. 
If the information is not present in the context, politely state that you do not know.
Always reference the source document and page number in your response when citing facts.
            Context:
            {context}"""),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}")
        ])
    
    def init_models(self):
        if self.provider=="ollama":
            self.embeddings=OllamaEmbeddings(
                model=os.getenv("OLLAMA_EMBED_MODEL"),
                base_url=os.getenv("OLLAMA_BASE_URL")
            )
            # LLM
            self.llm=ChatOllama(
                model=os.getenv("OLLAMA_MODEL"),
                base_url=os.getenv("OLLAMA_BASE_URL"),
                temperature=0.3 #low for factual information, no hallucination, increase closer to 1 if you want more creativity
            )
        elif self.provider=="openai":
            # Cloud alternative (uncomment when needed):
            # from langchain_openai import ChatOpenAI, OpenAIEmbeddings
            # self.embeddings=OpenAIEmbeddings(
            #     model=os.getenv("OPENAI_EMBED_MODEL"),
            #     openai_api_key=os.getenv("OPENAI_API_KEY")
            # )
            # # LLM
            # self.llm=ChatOpenAI(
            #     model=os.getenv("OPENAI_MODEL"),
            #     openai_api_key=os.getenv("OPENAI_API_KEY"),
            #     temperature=0.3
            # )
            pass
        elif self.provider=="gemini":
            # Cloud alternative (uncomment when needed):
            # from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
            # self.embeddings=GoogleGenerativeAIEmbeddings(
            #     model=os.getenv("GOOGLE_EMBED_MODEL"),
            #     api_key=os.getenv("GOOGLE_API_KEY")
            # )
            # # LLM
            # self.llm=ChatGoogleGenerativeAI(
            #     model=os.getenv("GOOGLE_MODEL"),
            #     api_key=os.getenv("GOOGLE_API_KEY"),
            #     temperature=0.3
            # )
            pass

    def process_pdf(self, file_path: str, doc_id: str):
        """ Loads a PDF, attaches document metadata, splits into chunks,
            and adds to the FAISS vector store."""
        try:
            # load the pdf
            loader=PyPDFLoader(file_path)
            docs=loader.load()

            # Tag each page with doc_id so we can filter searches later
            for doc in docs:
                doc.metadata["doc_id"]=doc_id

            # split into smaller chunks to keep embeddings efficient
            text_splitter=RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200
            )
            chunks=text_splitter.split_documents(docs)
            
            # Filter out empty or whitespace-only chunks (prevents Ollama empty prompt errors)
            chunks = [c for c in chunks if c.page_content and c.page_content.strip()]

            if not chunks:
                print("No text chunks extracted from PDF.")
                return 0

            # Create or add to FAISS vector store in batches (prevents Ollama timeouts on large PDFs)
            batch_size = 50
            total_batches = (len(chunks) + batch_size - 1) // batch_size
            print(f"Indexing {len(chunks)} valid text chunks in {total_batches} batches...")

            for i in range(0, len(chunks), batch_size):
                batch = chunks[i:i + batch_size]
                if self.vector_store is None:
                    self.vector_store = FAISS.from_documents(
                        documents=batch,
                        embedding=self.embeddings
                    )
                else:
                    self.vector_store.add_documents(batch)
                print(f"  Indexed batch {i//batch_size + 1}/{total_batches} ({len(batch)} chunks)")
            
            return len(chunks)

        except Exception as e:
            print("Error processing PDF:", e)
            import traceback
            traceback.print_exc()
            return 0

    

    def get_retriever(self, doc_id="all", top_k=4):
        """Returns FAISS retriever. Filters by doc_id if specified"""

        if self.vector_store is None:
            return None
        
        # if doc_id is provided, filter the search
        if doc_id and doc_id!="all":
            search_kwargs={
                "k": top_k,
                "filter": {"doc_id": doc_id}
            }
        # else search all documents
        else:
            search_kwargs={
                "k":top_k
            }
        
        # return the retriever
        return self.vector_store.as_retriever(
            search_type="similarity",
            search_kwargs=search_kwargs
        )
    
    def get_session_history(self, session_id: str):
        """Gets or creates a ChatMessageHistory for the given session ID"""
        if session_id not in self.sessions:
            self.sessions[session_id]=ChatMessageHistory()
        return self.sessions[session_id]

    def format_docs(self, docs):
        """Format retrieved documents for the LLM with page and document references"""
        formatted=[]

        for doc in docs:
            page_num=doc.metadata.get("page", 0)+1
            doc_id=doc.metadata.get("doc_id", "Doc")
            header=f"[Doc: {doc_id} | Page: {page_num}]"

            formatted.append(f"{header}\n{doc.page_content}")
        return "\n\n".join(formatted)
    
    def ask_pdf(self, question:str, session_id:str="default", doc_id="all"):
        if self.vector_store is None:
            return {
                "answer": "No documents have been uploaded yet. Please upload a PDF first.",
                "sources": []
            }

        # 1. Get retriever for specific doc_id or "all"
        retriever=self.get_retriever(doc_id=doc_id)

        # 2. Retrieve relevant chunks and format documents  
        retrieved_docs=retriever.invoke(question)
        formatted_docs=self.format_docs(retrieved_docs)

        # 3. Create LCEL chain with output parser
        chain= self.prompt | self.llm | StrOutputParser()

        # 4. Wrap chain with conversation history
        with_history=RunnableWithMessageHistory(
            chain,
            self.get_session_history,
            input_messages_key="input",
            history_messages_key="history"
        )
        
        # 5 Invoke the chain with session config
        response_text=with_history.invoke(
            {
                "context": formatted_docs,
                "input": question
            },
            config={
                "configurable":{
                    "session_id": session_id
                }
            }
        )

        # 6. Collect citation metadata for frontend (PDF.js page jumping)
        sources=[
            {
                "doc_id": doc.metadata.get("doc_id"),
                "page": doc.metadata.get("page", 0)+1,
                "snippet": doc.page_content[:200] # first 200 chars
            }
            for doc in retrieved_docs
        ]

        return {
            "answer": response_text,
            "sources": sources
        }

    def delete_document(self, doc_id: str):
        """Deletes all chunks belonging to doc_id from FAISS vector store."""
        if self.vector_store is None:
            return False

        try:
            docstore = self.vector_store.docstore
            index_to_docstore_id = self.vector_store.index_to_docstore_id

            remaining_docs = []
            for doc_uuid in index_to_docstore_id.values():
                doc = docstore.search(doc_uuid)
                if not doc or isinstance(doc, str):
                    continue
                if doc.metadata.get("doc_id") != doc_id:
                    remaining_docs.append(doc)

            if remaining_docs:
                self.vector_store = FAISS.from_documents(
                    documents=remaining_docs,
                    embedding=self.embeddings
                )
            else:
                self.vector_store = None
            return True
        except Exception as e:
            print(f"Error deleting document {doc_id}:", e)
            return False
    
    
if __name__ == "__main__":
    import sys
    
    print("[+] Initializing RAG Engine...")
    engine = RagEngine()

    # Place a PDF in your uploads/ folder to test
    sample_pdf_path = "uploads/sample.pdf"

    if os.path.exists(sample_pdf_path):
        print(f"[+] Processing {sample_pdf_path}...")
        chunks_count = engine.process_pdf(sample_pdf_path, doc_id="sample_doc")
        print(f"[+] Document processed into {chunks_count} vector chunks.")

        # Test query 1
        query = "What is the main topic of this document?"
        print(f"\n[?] Asking: '{query}'")
        res = engine.ask_pdf(query, session_id="test_session")
        
        print("\n[!] AI Response:")
        print(res["answer"])
        print("\n[*] Sources:")
        for s in res["sources"]:
            print(f"  - Doc: {s['doc_id']} | Page {s['page']}")

        # Test query 2 (Multi-turn follow-up test)
        followup = "Can you summarize it in 2 bullet points?"
        print(f"\n[?] Asking follow-up: '{followup}'")
        res2 = engine.ask_pdf(followup, session_id="test_session")
        print("\n[!] AI Response:")
        print(res2["answer"])

    else:
        print(f"[!] To test, create an 'uploads/' directory and add a PDF file named 'sample.pdf'.")

