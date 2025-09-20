from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import time
import random
import os
from datetime import datetime
import asyncio
import aiohttp

app = Flask(__name__)
CORS(app)

# Configurações
API_BASE_URL = "https://edusp-api.ip.tv"
CLIENT_DOMAIN = "https://trollchipsstarefas.vercel.app/"

class AuthManager:
    def __init__(self):
        self.headers = {
            'accept': '*/*',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'content-type': 'application/json',
            'origin': CLIENT_DOMAIN,
            'priority': 'u=0',
            'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-api-platform': 'webclient',
            'x-api-realm': 'edusp',
            'x-client-domain': CLIENT_DOMAIN,
        }
    
    def _generate_signature(self):
        import base64
        random_num = random.randint(10**8, 10**9)
        return base64.b64encode(str(random_num).encode()).decode()
    
    def _generate_timestamp(self):
        return str(int(time.time() * 1000))
    
    def _generate_request_id(self):
        chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
        return ''.join(random.choice(chars) for _ in range(6))
    
    def _get_headers(self):
        dynamic_headers = {
            'x-client-signature': self._generate_signature(),
            'x-client-timestamp': self._generate_timestamp(),
            'x-request-id': self._generate_request_id(),
        }
        return {**self.headers, **dynamic_headers}
    
    def login(self, ra, password):
        try:
            url = f"{API_BASE_URL}/registration/edusp"
            payload = {
                "login": ra,
                "password": password,
                "realm": "edusp"
            }
            
            headers = self._get_headers()
            
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            
            auth_data = response.json()
            
            user_info = {
                'nick': auth_data.get('nick'),
                'auth_token': auth_data.get('auth_token'),
                'external_id': auth_data.get('external_id'),
                'name': auth_data.get('name', '')
            }
            
            return {
                'success': True,
                'message': 'Login realizado com sucesso',
                'user_info': user_info
            }
            
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'message': f'Erro na autenticação: {str(e)}'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Erro inesperado: {str(e)}'
            }

class TaskProcessor:
    def __init__(self):
        self.base_url = API_BASE_URL
    
    def _get_headers(self, auth_token):
        auth_manager = AuthManager()
        base_headers = auth_manager._get_headers()
        
        headers = {
            **base_headers,
            'x-api-key': auth_token,
        }
        return headers
    
    def get_pending_tasks(self, auth_token):
        try:
            url = f"{self.base_url}/tms/task/todo"
            params = {
                'expired_only': 'false',
                'is_essay': 'false',
                'is_exam': 'false',
                'answer_statuses': ['draft', 'pending'],
                'with_answer': 'true',
                'with_apply_moment': 'true',
                'limit': 100,
                'filter_expired': 'true',
                'offset': 0
            }
            
            headers = self._get_headers(auth_token)
            
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            
            tasks = response.json().get('tasks', [])
            
            return {
                'success': True,
                'tasks': tasks,
                'count': len(tasks)
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Erro ao buscar tarefas pendentes: {str(e)}',
                'tasks': []
            }
    
    def get_expired_tasks(self, auth_token):
        try:
            url = f"{self.base_url}/tms/task/todo"
            params = {
                'expired_only': 'true',
                'is_essay': 'false',
                'is_exam': 'false',
                'answer_statuses': ['pending'],
                'with_answer': 'true',
                'with_apply_moment': 'true',
                'limit': 100,
                'filter_expired': 'false',
                'offset': 0
            }
            
            headers = self._get_headers(auth_token)
            
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            
            tasks = response.json().get('tasks', [])
            
            return {
                'success': True,
                'tasks': tasks,
                'count': len(tasks)
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Erro ao buscar tarefas expiradas: {str(e)}',
                'tasks': []
            }
    
    def get_task_details(self, auth_token, task_id):
        try:
            url = f"{self.base_url}/tms/task/{task_id}"
            
            headers = self._get_headers(auth_token)
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            task_details = response.json()
            
            return {
                'success': True,
                'task': task_details
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Erro ao buscar detalhes da tarefa: {str(e)}'
            }
    
    def submit_task_answer(self, auth_token, task_id, answers, is_draft=False):
        try:
            url = f"{self.base_url}/tms/task/{task_id}/answer"
            
            headers = self._get_headers(auth_token)
            
            payload = {
                "answers": answers,
                "final": not is_draft,
                "status": "draft" if is_draft else "submitted"
            }
            
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            
            return {
                'success': True,
                'message': 'Respostas enviadas com sucesso',
                'result': result
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Erro ao enviar respostas: {str(e)}'
            }
    
    def process_task(self, auth_token, task_data, time_min=1, time_max=3, is_draft=False):
        """Processa uma tarefa específica - responde automaticamente"""
        try:
            task_id = task_data.get('id')
            task_title = task_data.get('title', 'Tarefa sem título')
            
            # Obter detalhes da tarefa
            task_details = self.get_task_details(auth_token, task_id)
            if not task_details['success']:
                return task_details
            
            task_info = task_details['task']
            questions = task_info.get('questions', [])
            
            # Gerar respostas automáticas
            answers = {}
            for question in questions:
                question_id = question.get('id')
                question_type = question.get('type')
                
                # Pular questões do tipo info
                if question_type == 'info':
                    continue
                
                # Lógica para responder baseada no tipo de questão
                if question_type == 'multiple_choice':
                    options = question.get('options', [])
                    correct_options = [opt for opt in options if opt.get('correct')]
                    
                    if correct_options:
                        answer = {correct_options[0].get('id'): True}
                    else:
                        answer = {random.choice(options).get('id'): True}
                    
                    answers[str(question_id)] = {
                        'question_id': question_id,
                        'question_type': question_type,
                        'answer': answer
                    }
                else:
                    # Para outros tipos de questões, envia uma resposta padrão
                    answers[str(question_id)] = {
                        'question_id': question_id,
                        'question_type': question_type,
                        'answer': {'0': 'Resposta automática'}
                    }
            
            # Simular tempo de processamento
            processing_time = random.randint(time_min * 60, time_max * 60)
            time.sleep(processing_time)
            
            # Enviar respostas
            submission_result = self.submit_task_answer(auth_token, task_id, answers, is_draft)
            
            return {
                'success': True,
                'message': f'Tarefa "{task_title}" processada com sucesso',
                'task_id': task_id,
                'processing_time': processing_time,
                'submission_result': submission_result
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Erro ao processar tarefa: {str(e)}'
            }

# Inicializar componentes
auth_manager = AuthManager()
task_processor = TaskProcessor()

@app.route('/auth', methods=['POST'])
def authenticate():
    try:
        data = request.get_json()
        ra = data.get('ra')
        password = data.get('password')
        
        if not ra or not password:
            return jsonify({
                'success': False,
                'message': 'RA e senha são obrigatórios'
            }), 400
            
        auth_result = auth_manager.login(ra, password)
        
        if auth_result['success']:
            return jsonify(auth_result)
        else:
            return jsonify(auth_result), 401
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro interno durante autenticação: {str(e)}'
        }), 500

@app.route('/tasks/pending', methods=['POST'])
def get_pending_tasks():
    try:
        data = request.get_json()
        auth_token = data.get('auth_token')
        
        if not auth_token:
            return jsonify({
                'success': False,
                'message': 'Token de autenticação é obrigatório'
            }), 400
            
        tasks = task_processor.get_pending_tasks(auth_token)
        return jsonify(tasks)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar tarefas pendentes: {str(e)}'
        }), 500

@app.route('/tasks/expired', methods=['POST'])
def get_expired_tasks():
    try:
        data = request.get_json()
        auth_token = data.get('auth_token')
        
        if not auth_token:
            return jsonify({
                'success': False,
                'message': 'Token de autenticação é obrigatório'
            }), 400
            
        tasks = task_processor.get_expired_tasks(auth_token)
        return jsonify(tasks)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar tarefas expiradas: {str(e)}'
        }), 500

@app.route('/task/process', methods=['POST'])
def process_task():
    try:
        data = request.get_json()
        auth_token = data.get('auth_token')
        task_data = data.get('task')
        time_min = data.get('time_min', 1)
        time_max = data.get('time_max', 3)
        is_draft = data.get('is_draft', False)
        
        if not auth_token or not task_data:
            return jsonify({
                'success': False,
                'message': 'Token e dados da tarefa são obrigatórios'
            }), 400
            
        result = task_processor.process_task(auth_token, task_data, time_min, time_max, is_draft)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao processar tarefa: {str(e)}'
        }), 500

@app.route('/complete', methods=['POST'])
def complete_tasks():
    """Endpoint para processar múltiplas tarefas em lote"""
    try:
        data = request.get_json()
        tasks = data.get('tasks', [])
        auth_token = data.get('auth_token')
        time_min = data.get('time_min', 1)
        time_max = data.get('time_max', 3)
        is_draft = data.get('is_draft', False)
        
        if not auth_token or not tasks:
            return jsonify({
                'success': False,
                'message': 'Token e tarefas são obrigatórios'
            }), 400
        
        results = []
        
        for task in tasks:
            try:
                # Processar a tarefa
                result = task_processor.process_task(auth_token, task, time_min, time_max, is_draft)
                results.append({
                    'task_id': task.get('id'),
                    'success': result['success'],
                    'message': result['message'],
                    'processing_time': result.get('processing_time', 0)
                })
                
            except Exception as e:
                results.append({
                    'task_id': task.get('id'),
                    'success': False,
                    'message': f'Erro ao processar tarefa: {str(e)}'
                })
        
        return jsonify({
            'success': True,
            'message': f'Processamento concluído para {len(tasks)} tarefas',
            'results': results
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro interno: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'Servidor funcionando'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
