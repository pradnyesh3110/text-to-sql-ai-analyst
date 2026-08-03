# backend/prompt_builder.py
from backend.schema_extractor import get_schema_text

def build_prompt(question: str, rag_examples: str = "", table_names: list = None, primary_table: str = None) -> str:
    schema = get_schema_text(table_names)

    if primary_table:
        table_rule = f'5. The question refers to the file/table "{primary_table}" — use ONLY that table unless it truly cannot answer the question'
    elif table_names and len(table_names) == 1:
        table_rule = f'5. The main table is called "{table_names[0]}"'
    else:
        table_rule = "5. Pick whichever table(s) below best match the question — a table name often matches a file name mentioned in the question"

    prompt = f"""You are an expert PostgreSQL SQL generator.

IMPORTANT RULES:
1. Return ONLY the SQL query — nothing else
2. No explanation, no markdown, no code blocks, no backticks
3. Only SELECT statements allowed
4. Use double quotes around table and column names
{table_rule}
6. End with semicolon

DATABASE SCHEMA:
{schema}

QUESTION: {question}

SQL:"""

    return prompt
