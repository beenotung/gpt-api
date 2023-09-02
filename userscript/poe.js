// ==UserScript==
// @name         poe
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  provide API over poe
// @author       You
// @match        https://poe.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=poe.com
// @grant        none
// ==/UserScript==

;(function () {
  'use strict'

  // Your code here...
  console.log = console.debug
  console.error = console.debug

  let iteration = window.iteration || 0
  iteration++
  window.iteration = iteration

  function querySelector(selector) {
    let es = document.querySelectorAll(selector)
    if (es.length != 1) {
      throw new Error('failed to find ' + selector)
    }
    return es[0]
  }

  let textarea = querySelector('textarea')
  let sendButton = querySelector(
    'button[class*=ChatMessageInputContainer_sendButton]',
  )

  function waitFor(f, cb) {
    function loop() {
      if (window.iteration != iteration) {
        console.log('detected next iteration, stop waitFor()')
        return
      }
      if (f()) {
        cb()
      } else {
        setTimeout(loop)
      }
    }
    loop()
  }

  function sendMessage(options) {
    textarea.value = options.question
    textarea.focus()
    waitFor(
      () => !sendButton.disabled,
      () => {
        waitReply(options)
        textarea.value = textarea.value.trim()
        sendButton.click()
      },
    )
  }

  function waitReply(options) {
    let lastText = ''
    waitFor(
      () => document.querySelectorAll('[data-complete=false]').length > 0,
      () => {
        waitFor(
          () => {
            let es = document.querySelectorAll('[data-complete=false]')
            let e = es[es.length - 1]
            if (!e) {
              return true
            }
            let row = e.querySelector('[class*=ChatMessage_messageRow]')
            let html = row.outerHTML
            let text = row.innerText
            if (text == lastText) {
              return
            }
            lastText = text
            options.onUpdate({ html, text })
          },
          () => {
            let es = document.querySelectorAll('[data-complete=true]')
            let e = es[es.length - 1]
            let row = e.querySelector('[class*=ChatMessage_messageRow]')
            let html = row.outerHTML
            let text = row.innerText
            options.onComplete({ html, text })
          },
        )
      },
    )
  }

  let defaultOptions = {
    onUpdate: res => {
      window.res = res
      console.log('update:', {
        html: res.html.length,
        text: res.text.length,
      })
      console.log(res.text)
    },
    onComplete: res => {
      window.res = res
      console.log('complete:', {
        html: res.html.length,
        text: res.text.length,
      })
      console.log(res.text)
    },
  }

  function ask(options_or_question) {
    let options =
      typeof options_or_question == 'string'
        ? {
            ...defaultOptions,
            question: options_or_question,
          }
        : options_or_question
    sendMessage(options)
  }

  window.ask = ask

  let apiOrigin = 'http://localhost:8041'

  async function fetchJSON(url, init) {
    let res = await fetch(apiOrigin + url, init)
    let json = await res.json()
    if (json.error) {
      throw json.error
    }
    return json
  }

  function getTask() {
    return fetchJSON('/task', {
      headers: {
        Accept: 'application/json',
      },
    })
  }

  function updateTask(task, data) {
    return fetchJSON('/task/' + task.id + '/update', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  }

  function loop() {
    if (window.iteration != iteration) {
      console.log('detected next iteration, stop loop()')
      return
    }
    getTask()
      .then(({ task }) => {
        ask({
          question: task.question,
          onUpdate: data => {
            data.completed = false
            updateTask(task, data).catch(error => {
              console.error('failed to update task:', error)
            })
          },
          onComplete: data => {
            data.completed = true
            updateTask(task, data)
              .then(() => {
                loop()
              })
              .catch(error => {
                console.error('failed to update task:', error)
              })
          },
        })
      })
      .catch(error => {
        console.error('failed to get task:', error)
        if (String(error) == 'no task on queue') {
          setTimeout(loop)
        } else {
          setTimeout(loop, 3500)
        }
      })
  }

  loop()
})()
