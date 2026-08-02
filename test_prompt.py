from backend.prompt_builder import build_prompt

question = "Which genre has the most tracks?"
prompt = build_prompt(question)
print("=" * 80)
print(prompt)
print("=" * 80)