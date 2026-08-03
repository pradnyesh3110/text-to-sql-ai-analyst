from backend.database import run_query
from backend.llm_client import get_sql_from_llm
from backend.prompt_builder import build_prompt
import re

BLOCKED = ["DROP", "DELETE", "INSERT", "UPDATE", "TRUNCATE", "ALTER"]


def is_safe(sql: str) -> bool:
    return not any(word in sql.upper() for word in BLOCKED)


def extract_referenced_tables(sql: str) -> set:
    """Best-effort extraction of table names referenced via FROM/JOIN in a
    SELECT statement, used as a defense-in-depth check so a generated
    query can't accidentally (or via prompt injection) touch another
    user's table in a shared multi-tenant database."""
    pattern = re.compile(r'(?:FROM|JOIN)\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?', re.IGNORECASE)
    return {m.lower() for m in pattern.findall(sql)}


def is_within_allowed_tables(sql: str, allowed_tables: list) -> bool:
    if allowed_tables is None:
        return True
    allowed = {t.lower() for t in allowed_tables}
    referenced = extract_referenced_tables(sql)
    return referenced.issubset(allowed)


def sanitize_db_error(e: Exception) -> str:
    """Only the exception TYPE is ever sent to the LLM for auto-fixing —
    never the message body. Postgres error messages routinely echo back
    the actual literal/row value that caused the failure (e.g. invalid
    input syntax for type integer: "N/A"), which would otherwise leak
    real data to the LLM provider on every failed query."""
    return type(e).__name__.replace("_", " ")


def execute_with_retry(sql: str, question: str):
    if not is_safe(sql):
        return {"error": "Only SELECT queries are allowed."}

    try:
        return run_query(sql)

    except Exception as e:

        fix_prompt = f"""
Fix this PostgreSQL SQL error.

Return ONLY the corrected SQL.

Question:
{question}

Broken SQL:
{sql}

Error type:
{sanitize_db_error(e)}

Correct SQL:
"""

        fixed_sql = get_sql_from_llm(fix_prompt)

        try:
            return run_query(fixed_sql)

        except Exception as e2:
            return {
                "error": str(e2),
                "sql_tried": fixed_sql
            }


if __name__ == "__main__":

    question = "Which genre has the most tracks?"

    print("=" * 80)
    print("QUESTION")
    print(question)

    print("=" * 80)
    print("BUILDING PROMPT...")
    prompt = build_prompt(question)

    print("=" * 80)
    print("ASKING GEMINI...")
    sql = get_sql_from_llm(prompt)

    print("\nGenerated SQL:\n")
    print(sql)

    print("\nExecuting SQL...\n")
    result = execute_with_retry(sql, question)

    print(result)
