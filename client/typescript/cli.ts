import * as readline from 'readline'
import { askAndWait, Task } from './api'

export function main() {
  let rl = readline.createInterface({
    input: process.stdout,
    output: process.stdout,
  })
  let last_text = ''
  function showProgress(task: Task) {
    let text = task.text || 'no response yet...'
    if (text == last_text) {
      return
    }
    console.clear()
    console.log('='.repeat(32))
    console.log(task.question)
    console.log('='.repeat(32))
    console.log(text)
    console.log('='.repeat(32))
    last_text = text
  }
  function loop() {
    rl.question('Ask a question or type bye/exit/quit to exit: ', question => {
      switch (question) {
        case 'bye':
        case 'exit':
        case 'quit':
          rl.close()
          return
      }
      askAndWait(question, task => showProgress(task))
        .then(task => {
          showProgress(task)
          loop()
        })
        .catch(err => {
          console.error(err)
          loop()
        })
    })
  }
  loop()
}

if (process.argv[1] == __filename) {
  main()
}
