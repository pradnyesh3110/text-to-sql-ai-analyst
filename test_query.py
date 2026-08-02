# test_query.py
from backend.sql_executor import execute_with_retry
from backend.prompt_builder import build_prompt
from backend.llm_client import get_sql_from_llm

question = "which date has highest sales?"

prompt = build_prompt(question)
sql = get_sql_from_llm(prompt)

print("SQL:", sql)
print()

result = execute_with_retry(sql, question)
print("RESULT:", result)