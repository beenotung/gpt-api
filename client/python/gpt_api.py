import requests

api_origin = 'http://localhost:8041'


def createTask(question: str):
    res = requests.post(f"{api_origin}/tasks", {'question': question})
    json = res.json()
    if 'error' in json:
        raise Exception(json['error'])
    return json['id']


def getTask(id: str, completed=False):
    url = f"{api_origin}/tasks/{id}"
    if completed:
        url += "?completed=true"
    res = requests.get(url)
    json = res.json()
    if 'error' in json:
        raise Exception(json['error'])
    return json['task']


def deleteTask(id: str):
    res = requests.delete(f"{api_origin}/tasks/{id}")
    json = res.json()
    if 'error' in json:
        raise Exception(json['error'])
