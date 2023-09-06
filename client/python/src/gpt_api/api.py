import requests


api_origin = 'http://localhost:8041'


def ask(question: str, callback=None):
    id = create_task(question=question)
    if callback is None:
        return get_task(id=id, completed=True)
    while True:
        task = get_task(id=id, completed=False)
        callback(task)
        if 'completed' in task and task['completed'] is True:
            return task


def create_task(question: str):
    res = requests.post(f"{api_origin}/tasks", {'question': question})
    json = res.json()
    if 'error' in json:
        raise Exception(json['error'])
    return json['id']


def get_task(id: str, completed=False):
    url = f"{api_origin}/tasks/{id}"
    if completed:
        url += "?completed=true"
    res = requests.get(url)
    json = res.json()
    if 'error' in json:
        raise Exception(json['error'])
    return json['task']


def delete_task(id: str):
    res = requests.delete(f"{api_origin}/tasks/{id}")
    json = res.json()
    if 'error' in json:
        raise Exception(json['error'])
