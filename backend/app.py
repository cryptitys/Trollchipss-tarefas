from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import random
import time
import os

app = Flask(__name__)
CORS(app)

API_BASE_URL = "https://edusp-api.ip.tv"
CLIENT_ORIGIN = "https://trollchipss-tarefas.vercel.app"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"


# ------------------ HEADERS ------------------ #
def default_headers(extra=None):
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "x-api-realm": "edusp",
        "x-api-platform": "webclient",
        "User-Agent": USER_AGENT,
        "Origin": CLIENT_ORIGIN,
        "Referer": CLIENT_ORIGIN + "/",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Priority": "u=0",
    }
    if extra:
        headers.update(extra)
    return headers


# ------------------ AUTH ------------------ #
@app.route("/auth", methods=["POST"])
def auth():
    data = request.get_json()
    ra = data.get("ra")
    senha = data.get("password")

    if not ra or not senha:
        return jsonify({"success": False, "message": "RA e senha obrigatórios"}), 400

    payload = {"realm": "edusp", "platform": "webclient", "id": ra, "password": senha}

    try:
        r = requests.post(f"{API_BASE_URL}/registration/edusp",
                          headers=default_headers(), json=payload)
        if r.status_code != 200:
            return jsonify({"success": False, "message": "Falha no login", "detail": r.text}), r.status_code

        data = r.json()

        # devolve direto no formato simples para o front
        return jsonify({
            "success": True,
            "auth_token": data.get("auth_token"),
            "nick": data.get("nick"),
            "external_id": data.get("external_id"),
            "name": data.get("name", "")
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ------------------ ROOMS ------------------ #
def fetch_rooms(token):
    """Busca as salas do usuário"""
    r = requests.get(
        f"{API_BASE_URL}/room/user?list_all=true&with_cards=true",
        headers=default_headers({"x-api-key": token}),
    )
    r.raise_for_status()
    return r.json()


# ------------------ TASKS ------------------ #
@app.route("/tasks", methods=["POST"])
def tasks():
    data = request.get_json()
    token = data.get("auth_token")
    task_filter = data.get("filter", "pending")

    if not token:
        return jsonify({"success": False, "message": "Token é obrigatório"}), 400

    try:
        # 1) Buscar salas
        rooms = fetch_rooms(token)
        targets = []
        for room in rooms.get("rooms", []):
            if "id" in room:
                targets.append(str(room["id"]))
            if "name" in room:
                targets.append(room["name"])

        if not targets:
            return jsonify({"success": True, "tasks": [], "message": "Nenhuma sala encontrada"})

        # 2) Montar query com os publication_target
        base_params = {
            "limit": 100,
            "offset": 0,
            "is_exam": "false",
            "with_answer": "true",
            "is_essay": "false",
            "with_apply_moment": "true",
        }
        if task_filter == "expired":
            base_params["expired_only"] = "true"
            base_params["filter_expired"] = "false"
        else:
            base_params["expired_only"] = "false"
            base_params["filter_expired"] = "true"

        tasks_found = []
        for target in targets:
            params = base_params.copy()
            params["publication_target"] = target
            r = requests.get(f"{API_BASE_URL}/tms/task/todo",
                             headers=default_headers({"x-api-key": token}),
                             params=params)
            if r.status_code == 200:
                data = r.json()
                tasks_found.extend(data if isinstance(data, list) else data.get("tasks", []))

        return jsonify({"success": True, "tasks": tasks_found, "count": len(tasks_found)})

    except Exception as e:
        return jsonify({"success": False, "message": f"Erro ao buscar tarefas: {str(e)}"}), 500


# ------------------ PROCESS ONE TASK ------------------ #
@app.route("/task/process", methods=["POST"])
def process_task():
    data = request.get_json()
    token = data.get("auth_token")
    task = data.get("task")
    time_min = int(data.get("time_min", 1))
    time_max = int(data.get("time_max", 3))
    is_draft = data.get("is_draft", False)

    if not token or not task:
        return jsonify({"success": False, "message": "Token e dados da tarefa obrigatórios"}), 400

    try:
        task_id = task.get("id")
        r = requests.get(f"{API_BASE_URL}/tms/task/{task_id}",
                         headers=default_headers({"x-api-key": token}))
        r.raise_for_status()

        task_info = r.json()
        questions = task_info.get("questions", [])
        answers = {}

        # gerar respostas automáticas
        for q in questions:
            qid = q.get("id")
            qtype = q.get("type")
            if qtype == "info":
                continue

            if qtype == "multiple_choice":
                options = q.get("options", [])
                correct = [o for o in options if o.get("correct")]
                if correct:
                    answer = {correct[0].get("id"): True}
                else:
                    answer = {random.choice(options).get("id"): True}
                answers[str(qid)] = {"question_id": qid, "question_type": qtype, "answer": answer}
            else:
                answers[str(qid)] = {"question_id": qid, "question_type": qtype, "answer": {"0": "Resposta automática"}}

        processing_time = random.randint(time_min * 60, time_max * 60)
        time.sleep(processing_time)

        payload = {
            "answers": answers,
            "final": not is_draft,
            "status": "draft" if is_draft else "submitted"
        }
        submit_url = f"{API_BASE_URL}/tms/task/{task_id}/answer"
        resp = requests.post(submit_url, headers=default_headers({"x-api-key": token}), json=payload)
        resp.raise_for_status()

        return jsonify({"success": True, "task_id": task_id, "processing_time": processing_time, "result": resp.json()})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ------------------ COMPLETE MULTIPLE TASKS ------------------ #
@app.route("/complete", methods=["POST"])
def complete_tasks():
    data = request.get_json()
    token = data.get("auth_token")
    tasks = data.get("tasks", [])
    time_min = int(data.get("time_min", 1))
    time_max = int(data.get("time_max", 3))
    is_draft = data.get("is_draft", False)

    if not token or not tasks:
        return jsonify({"success": False, "message": "Token e tarefas obrigatórios"}), 400

    results = []
    for t in tasks:
        try:
            r = requests.post("http://localhost:5000/task/process", json={
                "auth_token": token,
                "task": t,
                "time_min": time_min,
                "time_max": time_max,
                "is_draft": is_draft
            })
            results.append(r.json())
        except Exception as e:
            results.append({"task_id": t.get("id"), "success": False, "message": str(e)})

    return jsonify({"success": True, "results": results})


# ------------------ HEALTH ------------------ #
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
