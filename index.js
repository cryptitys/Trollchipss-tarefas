// ==================== CONFIGURAÇÕES GLOBAIS ====================
const RENDER_API_URL = 'https://api.render.com/deploy/srv-d37ihkjuibrs7393hacg';
const RENDER_API_KEY = 'gcJRRvgq5OY';

// Variáveis globais
let currentFetchedTasks = [];
let currentTaskFilterType = '';
let trava = false;

// ==================== FUNÇÕES DE API ====================
async function callRenderAPI(endpoint, payload) {
    try {
        const response = await fetch(`${RENDER_API_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'API-Key': RENDER_API_KEY
            },
            body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Erro ao chamar endpoint ${endpoint}:`, error);
        return { 
            success: false, 
            message: error.message || 'Erro de conexão com o servidor'
        };
    }
}

async function login(ra, password) {
    try {
        const response = await callRenderAPI('auth', {
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

async function getPendingTasks(authToken, nick) {
    try {
        const response = await callRenderAPI('tasks/pending', {
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

async function getExpiredTasks(authToken, nick) {
    try {
        const response = await callRenderAPI('tasks/expired', {
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

async function processTasks(authToken, tasks, timeMin, timeMax, isDraft = false) {
    try {
        const response = await callRenderAPI('complete', {
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

// ==================== FUNÇÕES DE INTERFACE ====================
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
    if (container) {
        container.appendChild(notification);
        
        // Animação de entrada
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Remover após a duração especificada
        if (type !== 'processing') {
            setTimeout(() => {
                notification.classList.remove('show');
                notification.classList.add('fadeOut');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 400);
            }, duration);
        }
    }
    
    return notification;
}

function displayTasksInSelectionModal(tasks, filterType) {
    const taskListContainer = document.getElementById('taskListContainer');
    const selectAllCheckbox = document.getElementById('selectAllTasksCheckbox');
    
    if (!taskListContainer) return;
    
    taskListContainer.innerHTML = '';
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
    }

    if (!tasks || tasks.length === 0) {
        taskListContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Nenhuma tarefa encontrada.</p>';
    } else {
        tasks.forEach(task => {
            const listItem = document.createElement('div');
            listItem.className = 'task-list-item';
            
            listItem.innerHTML = `
                <input type="checkbox" id="task-${task.id}" value="${task.id}">
                <label for="task-${task.id}">
                    ${task.title || 'Tarefa sem título'}
                    <span style="color: var(--text-secondary); font-size: 0.85em; margin-left: 5px;">
                        (${task.answer_status === 'draft' ? 'Rascunho' : 'Pendente'})
                    </span>
                </label>
            `;
            
            taskListContainer.appendChild(listItem);
        });
    }

    const modalTitle = document.getElementById('taskSelectionModalTitle');
    if (modalTitle) {
        modalTitle.textContent = filterType === 'pending' ? 'Lições Pendentes' : 'Lições Expiradas';
    }
    
    const modal = document.getElementById('taskSelectionModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

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

// ==================== FUNÇÕES PRINCIPAIS ====================
async function loginAndFetchTasks(taskFilter, ra, password) {
    if (trava) return;
    trava = true;

    try {
        showNotification('Autenticação', 'Conectando com a API...', 'info');
        
        // Fazer login
        const loginResult = await login(ra, password);
        
        if (!loginResult || !loginResult.success) {
            showNotification('Erro', loginResult?.message || 'Falha no login', 'error');
            trava = false;
            return;
        }

        showNotification('Sucesso', 'Login realizado com sucesso!', 'success');
        
        // Buscar tarefas baseado no filtro
        showNotification('Busca', 'Buscando tarefas...', 'info');
        
        let tasksResult;
        if (taskFilter === 'pending') {
            tasksResult = await getPendingTasks(loginResult.auth_token || loginResult.user_info?.auth_token, loginResult.nick || loginResult.user_info?.nick);
        } else {
            tasksResult = await getExpiredTasks(loginResult.auth_token || loginResult.user_info?.auth_token, loginResult.nick || loginResult.user_info?.nick);
        }

        if (tasksResult && tasksResult.success) {
            currentFetchedTasks = tasksResult.tasks || [];
            currentTaskFilterType = taskFilter;
            
            displayTasksInSelectionModal(currentFetchedTasks, taskFilter);
            showNotification('Sucesso', `Encontradas ${tasksResult.count || currentFetchedTasks.length} tarefas`, 'success');
        } else {
            showNotification('Erro', tasksResult?.message || 'Erro ao buscar tarefas', 'error');
        }
        
    } catch (error) {
        showNotification('Erro', 'Ocorreu um erro inesperado', 'error');
        console.error('Erro:', error);
    } finally {
        trava = false;
    }
}

async function processSelectedTasks(tasks, isDraft) {
    const ra = document.getElementById('ra')?.value;
    const password = document.getElementById('senha')?.value;
    const timeMin = parseInt(document.getElementById('modalMinTime')?.value) || 1;
    const timeMax = parseInt(document.getElementById('modalMaxTime')?.value) || 3;

    if (!ra || !password) {
        showNotification('Erro', 'RA e senha são necessários', 'error');
        return;
    }

    // Fazer login novamente para obter o token
    const loginResult = await login(ra, password);
    
    if (!loginResult || !loginResult.success) {
        showNotification('Erro', 'Falha na autenticação', 'error');
        return;
    }

    // Fechar modal de seleção
    const modal = document.getElementById('taskSelectionModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Mostrar notificação de processamento
    const processingNotification = showNotification(
        'Processamento', 
        `Processando ${tasks.length} tarefa(s)...`, 
        'processing'
    );

    try {
        // Processar tarefas
        const result = await processTasks(
            loginResult.auth_token || loginResult.user_info?.auth_token,
            tasks,
            timeMin,
            timeMax,
            isDraft
        );

        // Remover notificação de processamento
        if (processingNotification && processingNotification.parentNode) {
            processingNotification.classList.remove('show');
            processingNotification.classList.add('fadeOut');
            setTimeout(() => {
                if (processingNotification.parentNode) {
                    processingNotification.parentNode.removeChild(processingNotification);
                }
            }, 400);
        }

        if (result && result.success) {
            showNotification('Sucesso', result.message || 'Tarefas processadas com sucesso', 'success');
            
            // Mostrar resultados detalhados
            if (result.results) {
                result.results.forEach(taskResult => {
                    if (taskResult.success) {
                        showNotification('Tarefa Concluída', taskResult.message, 'success', 5000);
                    } else {
                        showNotification('Erro na Tarefa', taskResult.message, 'error', 5000);
                    }
                });
            }
        } else {
            showNotification('Erro', result?.message || 'Erro ao processar tarefas', 'error');
        }
    } catch (error) {
        showNotification('Erro', 'Falha ao processar tarefas', 'error');
    }
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Sistema de automação de tarefas carregado!');
    console.log('🔗 Conectando com API:', RENDER_API_URL);
    
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
    const pendingBtn = document.getElementById('pendingLessonsBtn');
    if (pendingBtn) {
        pendingBtn.addEventListener('click', function() {
            const ra = document.getElementById('ra')?.value;
            const password = document.getElementById('senha')?.value;
            
            if (!ra || !password) {
                showNotification('Atenção', 'Preencha RA e senha', 'warning');
                return;
            }
            
            loginAndFetchTasks('pending', ra, password);
        });
    }

    // Botão de tarefas expiradas
    const expiredBtn = document.getElementById('expiredLessonsBtn');
    if (expiredBtn) {
        expiredBtn.addEventListener('click', function() {
            const ra = document.getElementById('ra')?.value;
            const password = document.getElementById('senha')?.value;
            
            if (!ra || !password) {
                showNotification('Atenção', 'Preencha RA e senha', 'warning');
                return;
            }
            
            loginAndFetchTasks('expired', ra, password);
        });
    }

    // Selecionar todas as tarefas
    const selectAllCheckbox = document.getElementById('selectAllTasksCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('#taskListContainer input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });
    }

    // Processar tarefas selecionadas
    const startSelectedBtn = document.getElementById('startSelectedTasksBtn');
    if (startSelectedBtn) {
        startSelectedBtn.addEventListener('click', async function() {
            const selectedTasks = getSelectedTasks();
            
            if (selectedTasks.length === 0) {
                showNotification('Atenção', 'Selecione pelo menos uma tarefa', 'warning');
                return;
            }
            
            await processSelectedTasks(selectedTasks, false);
        });
    }

    // Processar todas as tarefas
    const startAllBtn = document.getElementById('startAllTasksBtn');
    if (startAllBtn) {
        startAllBtn.addEventListener('click', async function() {
            if (currentFetchedTasks.length === 0) {
                showNotification('Atenção', 'Nenhuma tarefa para processar', 'warning');
                return;
            }
            
            await processSelectedTasks(currentFetchedTasks, false);
        });
    }

    // Processar como rascunho
    const startDraftBtn = document.getElementById('startSelectedTasksDraftBtn');
    if (startDraftBtn) {
        startDraftBtn.addEventListener('click', async function() {
            const selectedTasks = getSelectedTasks();
            
            if (selectedTasks.length === 0) {
                showNotification('Atenção', 'Selecione pelo menos uma tarefa', 'warning');
                return;
            }
            
            await processSelectedTasks(selectedTasks, true);
        });
    }

    // Fechar modal
    const closeModalBtn = document.getElementById('closeTaskSelectionModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            const modal = document.getElementById('taskSelectionModal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    }

    // Prevenir envio do formulário
    const form = document.getElementById('Enviar');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }
});
// ==================== SISTEMA DE RETRY INTELIGENTE ====================
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_BASE = 1000; // 1 segundo base
const RETRY_DELAY_MULTIPLIER = 2;

async function callRenderAPIWithRetry(endpoint, payload, retryCount = 0) {
    try {
        const response = await fetch(`${RENDER_API_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'API-Key': RENDER_API_KEY
            },
            body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            
            // Se for erro 5xx (servidor) ou 429 (muitas requisições), tenta novamente
            if ((response.status >= 500 && response.status < 600) || response.status === 429) {
                if (retryCount < MAX_RETRY_ATTEMPTS) {
                    const delay = RETRY_DELAY_BASE * Math.pow(RETRY_DELAY_MULTIPLIER, retryCount);
                    console.log(`🔄 Tentativa ${retryCount + 1}/${MAX_RETRY_ATTEMPTS}. Aguardando ${delay}ms...`);
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return callRenderAPIWithRetry(endpoint, payload, retryCount + 1);
                }
            }
            
            throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        if (retryCount < MAX_RETRY_ATTEMPTS && 
            (error.message.includes('Network') || error.message.includes('Failed to fetch'))) {
            const delay = RETRY_DELAY_BASE * Math.pow(RETRY_DELAY_MULTIPLIER, retryCount);
            console.log(`🌐 Tentativa ${retryCount + 1}/${MAX_RETRY_ATTEMPTS} (rede). Aguardando ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return callRenderAPIWithRetry(endpoint, payload, retryCount + 1);
        }
        
        throw error;
    }
}

// ==================== FUNÇÕES DE API COM RETRY ====================
async function callRenderAPI(endpoint, payload) {
    try {
        return await callRenderAPIWithRetry(endpoint, payload);
    } catch (error) {
        console.error(`Erro após todas as tentativas em ${endpoint}:`, error);
        return { 
            success: false, 
            message: error.message || 'Erro de conexão após múltiplas tentativas'
        };
    }
}

// ==================== SISTEMA DE FALLBACK AUTOMÁTICO ====================
async function intelligentFallbackSystem(operationName, operationFunction, fallbackPayload = null) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`🔄 Tentativa ${attempt}/3 para: ${operationName}`);
            
            const result = await operationFunction();
            if (result && result.success) {
                return result;
            }
            
            // Se falhou mas não é erro de rede, tenta abordagem alternativa
            if (attempt === 1 && fallbackPayload) {
                console.log('🔄 Tentando abordagem alternativa...');
                const fallbackResult = await operationFunction(fallbackPayload);
                if (fallbackResult && fallbackResult.success) {
                    return fallbackResult;
                }
            }
            
            lastError = result?.message || 'Erro desconhecido';
            
        } catch (error) {
            lastError = error.message;
            console.error(`Erro na tentativa ${attempt}:`, error);
        }
        
        // Espera progressivamente mais entre tentativas
        const delay = attempt * 2000;
        console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    throw new Error(`Falha após 3 tentativas em ${operationName}: ${lastError}`);
}

// ==================== FUNÇÕES ROBUSTAS COM FALLBACK ====================
async function robustLogin(ra, password) {
    return intelligentFallbackSystem('login', async () => {
        return callRenderAPI('auth', { ra, password });
    }, { ra, password, force: true }); // Fallback payload
}

async function robustGetTasks(taskType, authToken, nick) {
    return intelligentFallbackSystem(`get-${taskType}-tasks`, async () => {
        const endpoint = taskType === 'pending' ? 'tasks/pending' : 'tasks/expired';
        return callRenderAPI(endpoint, { auth_token: authToken, nick });
    });
}

async function robustProcessTasks(authToken, tasks, timeMin, timeMax, isDraft = false) {
    return intelligentFallbackSystem('process-tasks', async () => {
        return callRenderAPI('complete', {
            auth_token: authToken,
            tasks: tasks.slice(0, 3), // Processa menos tarefas no fallback
            time_min: timeMin,
            time_max: timeMax,
            is_draft: isDraft
        });
    }, {
        auth_token: authToken,
        tasks: tasks, // Fallback com todas as tarefas
        time_min: timeMin,
        time_max: timeMax,
        is_draft: isDraft
    });
}

// ==================== ATUALIZAÇÃO DAS FUNÇÕES PRINCIPAIS ====================
async function loginAndFetchTasks(taskFilter, ra, password) {
    if (trava) return;
    trava = true;

    try {
        showNotification('Autenticação', 'Conectando com a API...', 'info');
        
        // Usa o sistema robusto de login
        const loginResult = await robustLogin(ra, password);
        
        if (!loginResult || !loginResult.success) {
            showNotification('Erro', loginResult?.message || 'Falha no login após múltiplas tentativas', 'error');
            trava = false;
            return;
        }

        showNotification('Sucesso', 'Login realizado com sucesso!', 'success');
        
        // Buscar tarefas com sistema robusto
        showNotification('Busca', 'Buscando tarefas...', 'info');
        
        const authToken = loginResult.auth_token || loginResult.user_info?.auth_token;
        const nick = loginResult.nick || loginResult.user_info?.nick;
        
        const tasksResult = await robustGetTasks(taskFilter, authToken, nick);

        if (tasksResult && tasksResult.success) {
            currentFetchedTasks = tasksResult.tasks || [];
            currentTaskFilterType = taskFilter;
            
            displayTasksInSelectionModal(currentFetchedTasks, taskFilter);
            showNotification('Sucesso', `Encontradas ${tasksResult.count || currentFetchedTasks.length} tarefas`, 'success');
        } else {
            showNotification('Erro', tasksResult?.message || 'Erro ao buscar tarefas após múltiplas tentativas', 'error');
        }
        
    } catch (error) {
        showNotification('Erro', 'Falha crítica após todas as tentativas', 'error');
        console.error('Erro crítico:', error);
    } finally {
        trava = false;
    }
}

async function processSelectedTasks(tasks, isDraft) {
    const ra = document.getElementById('ra')?.value;
    const password = document.getElementById('senha')?.value;
    const timeMin = parseInt(document.getElementById('modalMinTime')?.value) || 1;
    const timeMax = parseInt(document.getElementById('modalMaxTime')?.value) || 3;

    if (!ra || !password) {
        showNotification('Erro', 'RA e senha são necessários', 'error');
        return;
    }

    // Fazer login com sistema robusto
    const loginResult = await robustLogin(ra, password);
    
    if (!loginResult || !loginResult.success) {
        showNotification('Erro', 'Falha na autenticação após múltiplas tentativas', 'error');
        return;
    }

    // Fechar modal de seleção
    const modal = document.getElementById('taskSelectionModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Mostrar notificação de processamento
    const processingNotification = showNotification(
        'Processamento', 
        `Processando ${tasks.length} tarefa(s) com sistema robusto...`, 
        'processing'
    );

    try {
        // Processar tarefas com sistema robusto
        const authToken = loginResult.auth_token || loginResult.user_info?.auth_token;
        const result = await robustProcessTasks(authToken, tasks, timeMin, timeMax, isDraft);

        // Remover notificação de processamento
        if (processingNotification && processingNotification.parentNode) {
            processingNotification.classList.remove('show');
            processingNotification.classList.add('fadeOut');
            setTimeout(() => {
                if (processingNotification.parentNode) {
                    processingNotification.parentNode.removeChild(processingNotification);
                }
            }, 400);
        }

        if (result && result.success) {
            showNotification('Sucesso', result.message || 'Tarefas processadas com sucesso após tentativas', 'success');
            
            // Mostrar resultados detalhados
            if (result.results) {
                result.results.forEach(taskResult => {
                    if (taskResult.success) {
                        showNotification('✅ Tarefa Concluída', taskResult.message, 'success', 5000);
                    } else {
                        showNotification('❌ Erro na Tarefa', taskResult.message, 'error', 5000);
                    }
                });
            }
        } else {
            showNotification('Erro', result?.message || 'Erro ao processar tarefas após todas as tentativas', 'error');
        }
    } catch (error) {
        showNotification('Erro', 'Falha crítica ao processar tarefas', 'error');
    }
}

// ==================== MONITORAMENTO DE SAÚDE DA API ====================
async function checkAPIHealth() {
    try {
        const response = await fetch(`${RENDER_API_URL}/health`, {
            method: 'GET',
            headers: {
                'API-Key': RENDER_API_KEY
            }
        });
        
        if (response.ok) {
            console.log('✅ API saudável');
            return true;
        }
    } catch (error) {
        console.warn('⚠️ API não respondendo, tentando reconexão...');
    }
    return false;
}

// Verifica saúde da API periodicamente
setInterval(async () => {
    const isHealthy = await checkAPIHealth();
    if (!isHealthy) {
        console.warn('⚠️ Monitor: API apresentando instabilidade');
    }
}, 30000); // A cada 30 segundos

// ==================== INICIALIZAÇÃO DO SISTEMA ROBUSTO ====================
console.log('🚀 Sistema robusto carregado!');
console.log('🔁 Máximo de tentativas:', MAX_RETRY_ATTEMPTS);
console.log('🌐 Monitoramento de API ativo');

// Verifica saúde inicial
checkAPIHealth().then(isHealthy => {
    if (!isHealthy) {
        console.warn('⚠️ Atenção: API pode estar instável no momento');
    }
});
