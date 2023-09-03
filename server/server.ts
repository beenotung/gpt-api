import { boolean, object, string } from 'cast.ts'
import express, { ErrorRequestHandler, Response } from 'express'
import { print } from 'listening-on'
import { HttpError } from './http.error'
import { randomUUID } from 'crypto'
import cors from 'cors'
import httpStatus from 'http-status'

let longPullingInterval = 5000
let taskTimeoutInterval = 3 * 60 * 1000

let app = express()

app.use(cors())
app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

type Task = {
  id: string
  question: string
  text?: string
  html?: string
  completed?: boolean
}

let taskDict: Record<string, Task> = {}
let taskQueue: Task[] = []

let getPendingTaskResponses: Response[] = []

let getCompletedTaskResponses = new Map<Task, Response[]>()

function getOrCreateGetCompletedTaskResponses(task: Task) {
  let responses = getCompletedTaskResponses.get(task)
  if (!responses) {
    responses = []
    getCompletedTaskResponses.set(task, responses)
  }
  return responses
}

function clearGetCompletedTaskResponses(
  task: Task,
  f: (res: Response) => void,
) {
  let responses = getCompletedTaskResponses.get(task)
  if (!responses) return
  responses.forEach(res => f(res))
  getCompletedTaskResponses.delete(task)
}

function dequeueTask(task: Task) {
  let index = taskQueue.indexOf(task)
  if (index != -1) taskQueue.splice(index, 1)
}

function deferLongPollingResponse(
  responses: Response[],
  res: Response,
  timeout: number,
) {
  responses.push(res)
  setTimeout(() => {
    let index = responses.indexOf(res)
    if (index == -1) return
    responses.splice(index, 1)
    res.redirect(httpStatus.TEMPORARY_REDIRECT, res.req.url)
  }, timeout)
}

function resolveLongPollingResponses(
  responses: Response[],
  f: (res: Response) => void,
) {
  responses.forEach(res => f(res))
  responses.length = 0
}

let createTaskParser = object({
  question: string({ trim: true, nonEmpty: true }),
})
app.post('/tasks', (req, res, next) => {
  let input = createTaskParser.parse(req.body, { name: 'req.body' })
  let id = randomUUID()
  let task: Task = { id, question: input.question }
  taskDict[id] = task
  taskQueue.push(task)
  res.json({ id })
  resolveLongPollingResponses(getPendingTaskResponses, res =>
    res.json({ task }),
  )
})

app.get('/tasks/pending', (req, res, next) => {
  let task = taskQueue[0]
  if (task) {
    res.json({ task })
    return
  }
  deferLongPollingResponse(getPendingTaskResponses, res, longPullingInterval)
})

app.get('/tasks/:id', (req, res, next) => {
  let id = req.params.id
  let task = taskDict[id]
  if (!task) throw new HttpError(404, `task not found, id: ${id}`)
  if (req.query.completed == 'true' && !task.completed) {
    let responses = getOrCreateGetCompletedTaskResponses(task)
    deferLongPollingResponse(responses, res, taskTimeoutInterval)
    return
  }
  res.json({ task })
})

let updateTaskParser = object({
  text: string(),
  html: string(),
  completed: boolean(),
})
app.patch('/tasks/:id', (req, res, next) => {
  let id = req.params.id
  let task = taskDict[id]
  if (!task) throw new HttpError(404, `task not found, id: ${id}`)
  let input = updateTaskParser.parse(req.body, { name: 'req.body' })
  task.text = input.text
  task.html = input.html
  task.completed = input.completed
  if (task.completed) {
    dequeueTask(task)
    clearGetCompletedTaskResponses(task, res => res.json({ task }))
  }
  res.json({ message: 'task updated' })
})

app.delete('/tasks/:id', (req, res, next) => {
  let id = req.params.id
  let task = taskDict[id]
  if (!task) throw new HttpError(404, `task not found, id: ${id}`)
  delete taskDict[id]
  dequeueTask(task)
  clearGetCompletedTaskResponses(task, res =>
    res.status(httpStatus.GONE).json({ error: 'task deleted' }),
  )
  res.json({ message: 'task deleted' })
})

app.use((req, res, next) =>
  next(
    new HttpError(
      404,
      `route not found, method: ${req.method}, url: ${req.url}`,
    ),
  ),
)

let errorHandler: ErrorRequestHandler = (err: HttpError, req, res, next) => {
  if (!err.statusCode) console.error(err)
  res.status(err.statusCode || 500)
  let error = String(err).replace(/^(\w*)Error: /, '')
  if (req.headers.accept?.includes('application/json')) {
    res.json({ error })
  } else {
    res.end(error)
  }
}
app.use(errorHandler)

let port = 8041
app.listen(port, () => {
  print(port)
})
