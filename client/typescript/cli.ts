#!/usr/bin/env node

import * as readline from 'readline'
import { ask, Task } from './api'

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
    console.log(task.question)
    console.log('='.repeat(32))
    console.log(text)
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
      ask(question, task => showProgress(task))
        .then(task => {
          console.log('='.repeat(32))
          console.log('text:', task.text.length, 'html:', task.html.length)
        })
        .catch(err => console.error(err))
        .finally(() => loop())
    })
  }
  loop()
}

if (process.argv[1] == __filename) {
  main()
}
