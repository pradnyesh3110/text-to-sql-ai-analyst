from backend.database import run_query
from backend.llm_client import get_sql_from_llm
from backend.prompt_builder import build_prompt

BLOCKED = ["DROP", "DELETE", "INSERT", "UPDATE", "TRUNCATE", "ALTER"]


def is_safe(sql: str) -> bool:
    return not any(word in sql.upper() for word in BLOCKED)


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

Error:
{str(e)}

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