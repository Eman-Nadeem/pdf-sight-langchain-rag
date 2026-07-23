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