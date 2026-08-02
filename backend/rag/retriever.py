# backend/rag/retriever.py

# In-memory examples for demo (no ChromaDB needed)
SAMPLE_EXAMPLES = [
    {
        "question": "How many rows are in the table?",
        "sql": "SELECT COUNT(*) FROM \"user_data\";"
    },
    {
        "question": "Show me all data",
        "sql": "SELECT * FROM \"user_data\" LIMIT 100;"
    },
    {
        "question": "What are the column names?",
        "sql": "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_data';"
    },
]

def get_similar_examples(question: str, n: int = 3) -> list:
    """Return sample SQL examples. In local version, uses ChromaDB."""
    return SAMPLE_EXAMPLES[:n]