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

  let onmessage

  function stopIteration(context) {
    console.log('detected next iteration, stop ' + context)
    proxyWindowP.then(proxyWindow => proxyWindow.close())
    window.removeEventListener('message', onmessage)
  }

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

  function waitFor(f, cb, intervals) {
    function loop() {
      if (window.iteration != iteration) {
        stopIteration('waitFor()')
        return
      }
      if (f()) {
        cb()
      } else {
        setTimeout(loop, intervals?.loop)
      }
    }
    if (intervals?.initial) {
      setTimeout(loop, intervals.initial)
    } else {
      loop()
    }
  }

  function sendMessage(options) {
    textarea.focus()
    textarea.value += options.question

    let event = new Event('input', {
      bubbles: true,
      cancelable: false,
      composed: true,
    })
    event.data = textarea.value
    textarea.dispatchEvent(event)

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
            waitFor(
              () => {
                let new_html = row.outerHTML
                let new_text = row.innerText
                if (new_html == html && new_text == text) {
                  return true
                }
                html = new_html
                text = new_text
              },
              () => {
                options.onComplete({ html, text })
              },
              {
                initial: 500,
                loop: 500,
              },
            )
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
  // let apiOrigin = 'http://127.0.0.1:8041'

  let messageListeners = new Set()

  let proxyWindowP = new Promise((resolve, reject) => {
    let proxyWindow = window.open(apiOrigin + '/frame.html')
    onmessage = event => {
      if (window.iteration != iteration) {
        stopIteration('onmessage()')
        return
      }
      if (event.origin != apiOrigin) return
      console.log('message.data:', event.data)
      if (event.data.type == 'frame-ready') {
        resolve(proxyWindow)
        return
      }
      messageListeners.forEach(listener => listener(event))
    }
    window.addEventListener('message', onmessage)
  })

  let messageCount = 0

  function fetchJSON(url, init) {
    console.log('fetch', { url, init })
    return proxyWindowP.then(
      proxyWindow =>
        new Promise((resolve, reject) => {
          messageCount++
          let id = messageCount
          let listener = event => {
            let { json, type } = event.data
            if (event.data.id != id || type != 'fetch-result') {
              return
            }
            messageListeners.delete(listener)
            if (json.error) {
              reject(json.error)
            } else {
              resolve(json)
            }
          }
          messageListeners.add(listener)
          proxyWindow.postMessage({ type: 'fetch', id, url, init }, apiOrigin)
        }),
    )

    // let res = await fetch(apiOrigin + url, init)
    // let json = await res.json()
    // if (json.error) {
    //   throw json.error
    // }
    // return json
  }

  function getPendingTask() {
    return fetchJSON('/tasks/pending', {
      headers: {
        Accept: 'application/json',
      },
    })
  }

  function updateTask(task, data) {
    return fetchJSON('/tasks/' + task.id, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  }

  function loop() {
    if (window.iteration != iteration) {
      stopIteration('loop()')
      return
    }
    getPendingTask()
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
