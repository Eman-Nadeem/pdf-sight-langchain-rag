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

load_dotenv()

class RagEngine:
    def __init__(self):
        self.provider=os.getenv("MODEL_PROVIDER")
        self.vector_store=None
        self.init_models()
    
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

            # Create or add to FAISS vector store using document chunks and embeddings
            if self.vector_store is None:
                self.vector_store=FAISS.from_documents(
                    documents=chunks,
                    embedding=self.embeddings
                )
            else:
                self.vector_store.add_documents(chunks)
            
            return len(chunks)

        except Exception as e:
            print("Error processing PDF:",e)
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