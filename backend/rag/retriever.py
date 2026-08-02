from backend.rag.vector_store import collection

def get_similar_examples(question: str, n: int = 3) -> str:
    results = collection.query(
        query_texts=[question],
        n_results=n
    )

    docs = results["documents"][0]
    metas = results["metadatas"][0]

    parts = []
    for q, m in zip(docs, metas):
        parts.append(f"Q: {q}\nSQL: {m['sql']}")

    return "\n\n".join(parts)

