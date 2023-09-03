from gpt_api import ask
import os


def clear_screen():
    try:
        os.system('clear')
    except Exception:
        os.system('cls')


last_text = None


def show_process(task):
    global last_text, question
    if 'text' in task:
        text = task['text']
    else:
        text = 'no response yet...'
    if text == last_text:
        return
    clear_screen()
    print('=' * 32)
    print(question)
    print('=' * 32)
    print(text)
    print('=' * 32)
    last_text = text


while True:
    question = input('Ask a question or type bye/exit/quit to exit: ')
    if question in ['bye', 'exit', 'quit']:
        break
    task = ask(question=question, callback=show_process)
    show_process(task)
