import { boolean, object, string } from 'cast.ts'
import express, { ErrorRequestHandler, Request, Response } from 'express'
import { print } from 'listening-on'
import { HttpError } from './http.error'
import { randomUUID } from 'crypto'
import cors from 'cors'

let longPullingInterval = 5000

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

let createTaskParser = object({
  question: string({ trim: true, nonEmpty: true }),
})

app.post('/task', (req, res, next) => {
  let input = createTaskParser.parse(req.body, { name: 'req.body' })
  let id = randomUUID()
  let task: Task = { id, question: input.question }
  taskDict[id] = task
  taskQueue.push(task)
  res.json({ id })
  getTaskResponses.forEach(res => {
    res.json({ task: taskQueue[0] })
  })
  getTaskResponses.length = 0
})

let getTaskResponses: Response[] = []
app.get('/task', (req, res, next) => {
  let task = taskQueue[0]
  if (task) {
    res.json({ task })
    return
  }
  getTaskResponses.push(res)
  setTimeout(() => {
    let index = getTaskResponses.indexOf(res)
    getTaskResponses.splice(index, 1)
    next(new HttpError(404, `no task on queue`))
  }, longPullingInterval)
})

app.get('/task/:id', (req, res, next) => {
  let id = req.params.id
  let task = taskDict[id]
  if (!task) throw new HttpError(404, `task not found, id: ${id}`)
  res.json({ task })
})

let updateTaskParser = object({
  text: string(),
  html: string(),
  completed: boolean(),
})
app.post('/task/:id/update', (req, res, next) => {
  let id = req.params.id
  let task = taskDict[id]
  if (!task) throw new HttpError(404, `task not found, id: ${id}`)
  let input = updateTaskParser.parse(req.body, { name: 'req.body' })
  task.text = input.text
  task.html = input.html
  task.completed = input.completed
  if (task.completed) {
    let index = taskQueue.indexOf(task)
    taskQueue.splice(index, 1)
  }
  res.json({ message: 'updated task' })
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
  res.status(err.statusCode || 500)
  if (req.headers.accept?.includes('application/json')) {
    res.json({ error: String(err).replace(/^(\w*)Error: /, '') })
  } else {
    next(err)
  }
}
app.use(errorHandler)

let port = 8041
app.listen(port, () => {
  print(port)
})
