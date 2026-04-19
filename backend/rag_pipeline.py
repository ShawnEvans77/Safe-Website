from pathlib import Path
from typing import List, Optional, Tuple

import faiss
import numpy as np
from dotenv import load_dotenv
from fastembed import TextEmbedding
from llama_index.core import SimpleDirectoryReader
from llama_index.core.node_parser import SentenceSplitter

BASE_DIR = Path(__file__).resolve().parent
DOCS_DIR = BASE_DIR / "docs"

load_dotenv(BASE_DIR / ".env")

FaissIndex = faiss.IndexFlatL2
EmbeddingArray = np.ndarray

embedder = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

chunk_texts: List[str] = []
faiss_index: Optional[FaissIndex] = None


def build_index(docs_folder: str | Path = DOCS_DIR) -> Tuple[FaissIndex, List[str]]:
    global faiss_index, chunk_texts

    docs_path = Path(docs_folder)
    if not docs_path.exists():
        raise FileNotFoundError(f"Docs folder not found: {docs_path}")

    docs = SimpleDirectoryReader(str(docs_path)).load_data()
    if not docs:
        raise ValueError(f"No documents found in: {docs_path}")

    splitter = SentenceSplitter(chunk_size=512, chunk_overlap=64)
    nodes = splitter.get_nodes_from_documents(docs)
    texts = [node.get_content() for node in nodes if node.get_content().strip()]
    if not texts:
        raise ValueError("Documents loaded, but no text chunks were extracted.")

    chunk_texts = texts

    embeddings = np.asarray(list(embedder.embed(texts)), dtype=np.float32)

    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)

    faiss_index = index
    return index, chunk_texts


def retrieve(query: str, top_k: int = 3) -> List[str]:
    global faiss_index, chunk_texts

    if faiss_index is None:
        build_index()

    assert faiss_index is not None

    query_embedding = np.asarray(list(embedder.embed([query])), dtype=np.float32)

    _, indices = faiss_index.search(query_embedding, top_k)

    results: List[str] = []
    for i in indices[0]:
        if 0 <= i < len(chunk_texts):
            results.append(chunk_texts[i])

    return results


if __name__ == "__main__":
    build_index()
    for i, result in enumerate(retrieve("caller feels numb and disconnected"), start=1):
        print(f"\n--- Chunk {i} ---\n{result[:300]}")