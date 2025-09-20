// Configurações da API
const PYTHON_SERVER_URL = 'https://trollchipss-tarefas.onrender.com';

// Variáveis globais
let globalAuthToken = null;
let globalNick = null;
let currentFetchedTasks = [];
let currentTaskFilterType = '';
let trava = false;

// Função para fazer requisições à API
async function callBackendEndpoint(endpoint, payload) {
    try {
        const response = await fetch(`${PYTHON_SERVER_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Erro ao chamar o endpoint ${endpoint}:`, error);
        return { success: false, message: error.message };
    }
}

// Função para exibir notificações
function showNotification(title, message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `Notificacao ${type}`;
    
    let icon = '';
    switch (type) {
        case 'success': icon = 'fa-check-circle'; break;
        case 'error': icon = 'fa-exclamation-circle'; break;
        case 'warning': icon = 'fa-exclamation-triangle'; break;
        default: icon = 'fa-info-circle';
    }
    
    notification.innerHTML = `
        <h3><i class="fas ${icon}"></i> ${title}</h3>
        <p>${message}</p>
    `;
    
    const container = document.getElementById('notificationsContainer');
    container.appendChild(notification);
    
    // Animação de entrada
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remover após a duração especificada
    if (type !== 'processing') {
        setTimeout(() => {
            notification.classList.remove('show');
            notification.classList.add('fadeOut');
            setTimeout(() => notification.remove(), 400);
        }, duration);
    }
    
    return notification;
}

// Função para autenticação
async function login(ra, password) {
    try {
        const response = await callBackendEndpoint('auth', {
            ra: ra,
            password: password
        });
        
        return response;
    } catch (error) {
        return {
            success: false,
            message: 'Erro de conexão com o servidor'
        };
    }
}

// Função para buscar tarefas pendentes
async function getPendingTasks(authToken, nick) {
    try {
        const response = await callBackendEndpoint('tasks/pending', {
            auth_token: authToken,
            nick: nick
        });
        
        return response;
    } catch (error) {
        return {
            success: false,
            message: 'Erro ao buscar tarefas pendentes'
        };
    }
}

// Função para buscar tarefas expiradas
async function getExpiredTasks(authToken, nick) {
    try {
        const response = await callBackendEndpoint('tasks/expired', {
            auth_token: authToken,
            nick: nick
        });
        
        return response;
    } catch (error) {
        return {
            success: false,
            message: 'Erro ao buscar tarefas expiradas'
        };
    }
}

// Função para processar múltiplas tarefas
async function processTasks(authToken, tasks, timeMin, timeMax, isDraft = false) {
    try {
        const response = await callBackendEndpoint('complete', {
            auth_token: authToken,
            tasks: tasks,
            time_min: timeMin,
            time_max: timeMax,
            is_draft: isDraft
        });
        
        return response;
    } catch (error) {
        return {
            success: false,
            message: 'Erro ao processar tarefas'
        };
    }
}

// Função para exibir tarefas no modal de seleção
function displayTasksInSelectionModal(tasks, filterType) {
    const taskListContainer = document.getElementById('taskListContainer');
    const selectAllCheckbox = document.getElementById('selectAllTasksCheckbox');
    
    taskListContainer.innerHTML = '';
    selectAllCheckbox.checked = false;

    if (tasks.length === 0) {
        taskListContainer.innerHTML = '<p style="text-align: center; color: var(--eclipse-text-secondary); padding: 20px;">Nenhuma tarefa encontrada.</p>';
    } else {
        tasks.forEach(task => {
            const listItem = document.createElement('div');
            listItem.className = 'task-list-item';
            
            listItem.innerHTML = `
                <input type="checkbox" id="task-${task.id}" value="${task.id}">
                <label for="task-${task.id}">
                    ${task.title}
                    <span style="color: var(--eclipse-text-secondary); font-size: 0.85em; margin-left: 5px;">
                        (${task.answer_status === 'draft' ? 'Rascunho' : 'Pendente'})
                    </span>
                </label>
            `;
            
            taskListContainer.appendChild(listItem);
        });
    }

    document.getElementById('taskSelectionModalTitle').textContent = 
        filterType === 'pending' ? 'Lições Pendentes' : 'Lições Expiradas';
    
    document.getElementById('taskSelectionModal').style.display = 'flex';
}

// Função principal para login and fetch tasks
async function loginAndFetchTasks(taskFilter, ra, password) {
    if (trava) return;
    trava = true;

    try {
        showNotification('Autenticação', 'Realizando login...', 'info');
        
        // Fazer login
        const loginResult = await login(ra, password);
        
        if (!loginResult.success) {
            showNotification('Erro', loginResult.message, 'error');
            trava = false;
            return;
        }

        showNotification('Sucesso', 'Login realizado com sucesso!', 'success');
        
        // Buscar tarefas baseado no filtro
        showNotification('Busca', 'Buscando tarefas...', 'info');
        
        let tasksResult;
        if (taskFilter === 'pending') {
            tasksResult = await getPendingTasks(loginResult.user_info.auth_token, loginResult.user_info.nick);
        } else {
            tasksResult = await getExpiredTasks(loginResult.user_info.auth_token, loginResult.user_info.nick);
        }

        if (tasksResult.success) {
            currentFetchedTasks = tasksResult.tasks;
            currentTaskFilterType = taskFilter;
            
            displayTasksInSelectionModal(currentFetchedTasks, taskFilter);
            showNotification('Sucesso', `Encontradas ${tasksResult.count} tarefas`, 'success');
        } else {
            showNotification('Erro', tasksResult.message, 'error');
        }
        
    } catch (error) {
        showNotification('Erro', 'Ocorreu um erro inesperado', 'error');
        console.error('Erro:', error);
    } finally {
        trava = false;
    }
}

// Função para obter tarefas selecionadas
function getSelectedTasks() {
    const selectedTasks = [];
    const checkboxes = document.querySelectorAll('#taskListContainer input[type="checkbox"]:checked');
    
    checkboxes.forEach(checkbox => {
        const taskId = checkbox.value;
        const task = currentFetchedTasks.find(t => t.id.toString() === taskId);
        if (task) {
            selectedTasks.push(task);
        }
    });
    
    return selectedTasks;
}

// Função para processar tarefas selecionadas
async function processSelectedTasks(tasks, isDraft) {
    const ra = document.getElementById('ra').value;
    const password = document.getElementById('senha').value;
    const timeMin = parseInt(document.getElementById('modalMinTime').value) || 1;
    const timeMax = parseInt(document.getElementById('modalMaxTime').value) || 3;

    // Fazer login novamente para obter o token
    const loginResult = await login(ra, password);
    
    if (!loginResult.success) {
        showNotification('Erro', 'Falha na autenticação', 'error');
        return;
    }

    // Fechar modal de seleção
    document.getElementById('taskSelectionModal').style.display = 'none';
    
    // Mostrar notificação de processamento
    const processingNotification = showNotification(
        'Processamento', 
        `Processando ${tasks.length} tarefa(s)...`, 
        'processing'
    );

    try {
        // Processar tarefas
        const result = await processTasks(
            loginResult.user_info.auth_token,
            tasks,
            timeMin,
            timeMax,
            isDraft
        );

        // Remover notificação de processamento
        if (processingNotification) {
            processingNotification.classList.remove('show');
            processingNotification.classList.add('fadeOut');
            setTimeout(() => processingNotification.remove(), 400);
        }

        if (result.success) {
            showNotification('Sucesso', result.message, 'success');
            
            // Mostrar resultados detalhados
            result.results.forEach(taskResult => {
                if (taskResult.success) {
                    showNotification('Tarefa Concluída', taskResult.message, 'success', 5000);
                } else {
                    showNotification('Erro na Tarefa', taskResult.message, 'error', 5000);
                }
            });
        } else {
            showNotification('Erro', result.message, 'error');
        }
    } catch (error) {
        showNotification('Erro', 'Falha ao processar tarefas', 'error');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Toggle de senha
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('senha');
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    // Botão de tarefas pendentes
    document.getElementById('pendingLessonsBtn').addEventListener('click', function() {
        const ra = document.getElementById('ra').value;
        const password = document.getElementById('senha').value;
        
        if (!ra || !password) {
            showNotification('Atenção', 'Preencha RA e senha', 'warning');
            return;
        }
        
        loginAndFetchTasks('pending', ra, password);
    });

    // Botão de tarefas expiradas
    document.getElementById('expiredLessonsBtn').addEventListener('click', function() {
        const ra = document.getElementById('ra').value;
        const password = document.getElementById('senha').value;
        
        if (!ra || !password) {
            showNotification('Atenção', 'Preencha RA e senha', 'warning');
            return;
        }
        
        loginAndFetchTasks('expired', ra, password);
    });

    // Selecionar todas as tarefas
    document.getElementById('selectAllTasksCheckbox').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('#taskListContainer input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });

    // Processar tarefas selecionadas
    document.getElementById('startSelectedTasksBtn').addEventListener('click', async function() {
        const selectedTasks = getSelectedTasks();
        
        if (selectedTasks.length === 0) {
            showNotification('Atenção', 'Selecione pelo menos uma tarefa', 'warning');
            return;
        }
        
        await processSelectedTasks(selectedTasks, false);
    });

    // Processar todas as tarefas
    document.getElementById('startAllTasksBtn').addEventListener('click', async function() {
        await processSelectedTasks(currentFetchedTasks, false);
    });

    // Processar como rascunho
    document.getElementById('startSelectedTasksDraftBtn').addEventListener('click', async function() {
        const selectedTasks = getSelectedTasks();
        
        if (selectedTasks.length === 0) {
            showNotification('Atenção', 'Selecione pelo menos uma tarefa', 'warning');
            return;
        }
        
        await processSelectedTasks(selectedTasks, true);
    });

    // Fechar modal
    document.getElementById('closeTaskSelectionModalBtn').addEventListener('click', function() {
        document.getElementById('taskSelectionModal').style.display = 'none';
    });
});

// Prevenir envio do formulário
document.getElementById('Enviar').addEventListener('submit', (e) => {
    e.preventDefault();
});
