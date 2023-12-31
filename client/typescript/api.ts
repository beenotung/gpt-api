let api_origin = 'http://localhost:8041'

export type UUID = string

export type Task = {
  id: string
  question: string
  text?: string
  html?: string
  completed?: boolean
}

export type CompletedTask = {
  id: string
  question: string
  text: string
  html: string
  completed: true
}

export async function ask(
  question: string,
  callback?: (task: Task) => void | Promise<void>,
): Promise<CompletedTask> {
  let id = await createTask(question)
  if (!callback) {
    return waitAndGetTask(id)
  }
  for (;;) {
    let task = await getTask(id)
    await callback(task)
    if (task.completed) {
      return task as CompletedTask
    }
  }
}

export async function createTask(question: string): Promise<UUID> {
  let res = await fetch(`${api_origin}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ question }),
  })
  let json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.id
}

export async function getTask(id: UUID): Promise<Task> {
  let res = await fetch(`${api_origin}/tasks/${id}`, {
    headers: { Accept: 'application/json' },
  })
  let json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.task
}

export async function waitAndGetTask(id: UUID): Promise<CompletedTask> {
  let res = await fetch(`${api_origin}/tasks/${id}?completed=true`, {
    headers: { Accept: 'application/json' },
  })
  let json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.task
}

export async function deleteTask(id: UUID): Promise<void> {
  let res = await fetch(`${api_origin}/tasks/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  let json = await res.json()
  if (json.error) throw new Error(json.error)
}
