# backend/batch_handler.py
import time
from backend.prompt_builder  import build_prompt
from backend.llm_client      import get_sql_from_llm
from backend.sql_executor    import execute_with_retry
from backend.rag.retriever   import get_similar_examples

def run_batch(questions: list) -> list:
    results = []

    for i, question in enumerate(questions):
        print(f"Batch {i+1}/{len(questions)}: {question}")
        try:
            rag    = get_similar_examples(question, n=3)
            prompt = build_prompt(question, rag)
            sql    = get_sql_from_llm(prompt)
            result = execute_with_retry(sql, question)

            results.append({
                "question" : question,
                "sql"      : sql,
                "result"   : result,
                "status"   : "success"
            })

        except Exception as e:
            results.append({
                "question" : question,
                "sql"      : None,
                "result"   : None,
                "status"   : "error",
                "error"    : str(e)
            })

        if i < len(questions) - 1:
            time.sleep(4)

    return results