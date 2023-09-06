from .api import ask
import os


def clear_screen():
    try:
        os.system('clear')
    except Exception:
        os.system('cls')


last_text = None


def show_progress(task):
    global last_text, question
    if 'text' in task:
        text = task['text']
    else:
        text = 'no response yet...'
    if text == last_text:
        return
    clear_screen()
    print(question)
    print('=' * 32)
    print(text)
    last_text = text


def main():
    while True:
        question = input('Ask a question or type bye/exit/quit to exit: ')
        if question in ['bye', 'exit', 'quit']:
            break
        task = ask(question=question, callback=show_progress)
        print('=' * 32)
        print(f"text: {len(task['text'])}, html: {len(task['html'])}")


if __name__ == '__main__':
    main()
