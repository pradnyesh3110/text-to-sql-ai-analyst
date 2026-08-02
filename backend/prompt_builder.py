# backend/prompt_builder.py
from backend.schema_extractor import get_schema_text

def build_prompt(question: str, rag_examples: str = "") -> str:
    schema = get_schema_text()

    prompt = f"""You are an expert PostgreSQL SQL generator.

IMPORTANT RULES:
1. Return ONLY the SQL query — nothing else
2. No explanation, no markdown, no code blocks, no backticks
3. Only SELECT statements allowed
4. Use double quotes around table and column names
5. The main table is called user_data
6. End with semicolon

DATABASE SCHEMA:
{schema}

QUESTION: {question}

SQL:"""

    return prompt