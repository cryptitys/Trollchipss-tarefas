document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------
    // VARIÁVEIS GLOBAIS
    // ------------------------------
    let processingTasks = new Set();
    let globalAuthToken = '';
    let globalNick = '';
    let globalExternalId = '';
    let globalProcessId = '';

    const categoryMap = {}; // Preencher com IDs de categoria do backend

    // ------------------------------
    // ELEMENTOS DO DOM
    // ------------------------------
    const tasksContent = document.getElementById('tasksContent');
    const noTasks = document.getElementById('noTasks');
    const taskProcessingModal = document.getElementById('taskProcessingModal');
    const batchProcessingModal = document.getElementById('batchProcessingModal');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingTitle = document.querySelector('.loading-title');
    const loadingMessage = document.querySelector('.loading-message');
    const mainSection = document.getElementById('mainSection');

    const doTaskButton = document.getElementById('doTaskButton');
    const saveDraftButton = document.getElementById('saveDraftButton');
    const processAllTasksButton = document.getElementById('processAllTasksButton');
    const processSelectedTasksButton = document.getElementById('processSelectedTasksButton');

    const batchTasksList = document.getElementById('batchTasksList');
    const batchSelectAll = document.getElementById('batchSelectAll');
    const batchSelectAllDraft = document.getElementById('batchSelectAllDraft');
    const batchDeselectAll = document.getElementById('batchDeselectAll');
    const batchMinTime = document.getElementById('batchMinTime');
    const batchMaxTime = document.getElementById('batchMaxTime');

    const authForm = document.getElementById('authForm');
    const loginModal = document.getElementById('loginModal');
    const togglePasswordLogin = document.getElementById('togglePasswordLogin');

    const minTime = document.getElementById('minTime');
    const maxTime = document.getElementById('maxTime');
    const modalProcessingTitle = document.getElementById('modalProcessingTitle');
    const modalProcessingSubject = document.getElementById('modalProcessingSubject');
    const modalProcessingStatus = document.getElementById('modalProcessingStatus');
    const modalProcessingTaskId = document.getElementById('modalProcessingTaskId');
    const modalProcessingFirstAccess = document.getElementById('modalProcessingFirstAccess');
    const modalProcessingDescription = document.getElementById('modalProcessingDescription');

    // ------------------------------
    // FUNÇÕES UTILITÁRIAS
    // ------------------------------

    // Simulação de requisição para backend
    async function callBackendEndpoint(endpoint, payload, serverUrl = '') {
        console.log(`Chamando endpoint ${endpoint} com payload:`, payload);
        // Aqui você implementará a chamada real para o backend
        try {
            const response = await fetch(`${serverUrl}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro na requisição:', error);
            throw error;
        }
    }

    function showNotification(message, type = 'info', duration = 3000) {
        const notificationContainer = document.getElementById('notificationContainer');
        if (!notificationContainer) return;

        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${type}`;
        
        let iconHtml = '';
        switch(type) {
            case 'info': 
                iconHtml = '<i class="fas fa-info-circle icon"></i>';
                break;
            case 'warning': 
                iconHtml = '<i class="fas fa-exclamation-triangle icon"></i>';
                break;
            case 'success': 
                iconHtml = '<i class="fas fa-check-circle icon"></i>';
                break;
            case 'error': 
                iconHtml = '<i class="fas fa-times-circle icon"></i>';
                break;
        }

        notificationItem.innerHTML = `${iconHtml}<span class="message">${message}</span>`;
        notificationContainer.appendChild(notificationItem);
        
        // Força o reflow para garantir a transição
        void notificationItem.offsetWidth;
        notificationItem.classList.add('show');

        setTimeout(() => {
            notificationItem.classList.remove('show');
            notificationItem.classList.add('hide');
            notificationItem.addEventListener('transitionend', () => notificationItem.remove(), { once: true });
        }, duration);
    }

    function showCustomMessage(message, callback = null) {
        const messageBox = document.createElement('div');
        messageBox.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: #1e1e2f;
            color: #fff;
            padding: 20px;
            border-radius: 10px;
            z-index: 2000;
            text-align: center;
            max-width: 80%;
            border: 1px solid #555;
        `;
        messageBox.innerHTML = `
            <p class="mb-4">${message}</p>
            <button id="messageBoxCloseButton" class="px-4 py-2 rounded-md" style="background-color: #3b82f6; color: white;">OK</button>
        `;
        document.body.appendChild(messageBox);

        document.getElementById('messageBoxCloseButton').addEventListener('click', () => {
            document.body.removeChild(messageBox);
            if (callback) callback();
        });
    }

    function showLoadingOverlay(title, message) {
        if (loadingTitle) loadingTitle.textContent = title;
        if (loadingMessage) loadingMessage.textContent = message;
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoadingOverlay() {
        loadingOverlay.classList.add('hidden');
    }

    function formatDate(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    }

    function formatDateTime(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }

    function togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const icon = document.getElementById('togglePasswordLogin');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    // ------------------------------
    // MODAIS
    // ------------------------------
    function closeTaskProcessingModal() {
        taskProcessingModal.classList.add('hidden');
    }

    function closeBatchProcessingModal() {
        batchProcessingModal.classList.add('hidden');
    }

    // Event listeners para fechar modais ao clicar fora
    taskProcessingModal.addEventListener('click', (e) => {
        if (e.target === taskProcessingModal) closeTaskProcessingModal();
    });

    batchProcessingModal.addEventListener('click', (e) => {
        if (e.target === batchProcessingModal) closeBatchProcessingModal();
    });

    // ------------------------------
    // PROCESSAMENTO INDIVIDUAL
    // ------------------------------
    function openTaskProcessingModal(task) {
        // Preenche os dados da tarefa no modal
        modalProcessingTitle.textContent = task.title || 'Título Indisponível';
        modalProcessingSubject.textContent = task.subject || 'Matéria Indisponível';
        modalProcessingStatus.textContent = task.status || 'Status Indisponível';
        modalProcessingDescription.textContent = task.description || 'Descrição Indisponível';
        modalProcessingTaskId.textContent = task.id || 'N/A';
        modalProcessingFirstAccess.textContent = formatDateTime(task.firstAccess) || 'N/A';
        
        // Armazena dados da tarefa no modal para uso posterior
        taskProcessingModal.dataset.taskId = task.id;
        taskProcessingModal.dataset.roomNameForApply = task.roomNameForApply || '';
        taskProcessingModal.dataset.answerId = task.answerId || '';
        
        // Exibe o modal
        taskProcessingModal.classList.remove('hidden');
    }

    async function handleIndividualTaskProcessing(isDraft = false) {
        const taskId = taskProcessingModal.dataset.taskId;
        if (!taskId) return;
        
        if (processingTasks.has(taskId)) {
            showNotification(`Esta tarefa já está sendo processada.`, 'warning');
            return;
        }

        closeTaskProcessingModal();
        processingTasks.add(taskId);
        
        const taskName = modalProcessingTitle.textContent;
        const actionText = isDraft ? 'salva como rascunho' : 'enviada';
        const processingActionText = isDraft ? 'salvando como rascunho' : 'processada';

        showNotification(`Tarefa "${taskName}" está sendo ${processingActionText}.`, 'info');

        try {
            const payload = {
                auth_token: globalAuthToken,
                room_name_for_apply: taskProcessingModal.dataset.roomNameForApply || null,
                tasks: [{
                    task_id: taskId, 
                    answer_id: taskProcessingModal.dataset.answerId || null, 
                    salvar_rascunho: isDraft.toString()
                }]
            };
            
            const response = await callBackendEndpoint('fazer_task', payload);

            if (response.success) {
                showNotification(`Tarefa "${taskName}" ${actionText} com sucesso!`, 'success');
            } else {
                showNotification(`Erro ao processar tarefa "${taskName}": ${response.message || 'Erro desconhecido.'}`, 'error');
            }
        } catch (error) {
            console.error(error);
            showNotification(`Erro ao processar tarefa "${taskName}": ${error.message}`, 'error');
        } finally {
            processingTasks.delete(taskId);
            // Recarregar tarefas após processamento
            loadTasks();
        }
    }

    // Event listeners para os botões de processamento
    doTaskButton.addEventListener('click', () => handleIndividualTaskProcessing(false));
    saveDraftButton.addEventListener('click', () => handleIndividualTaskProcessing(true));

    // ------------------------------
    // PROCESSAMENTO EM LOTE
    // ------------------------------
    processAllTasksButton.addEventListener('click', async () => {
        showLoadingOverlay("Carregando Tarefas...", "Buscando tarefas pendentes e expiradas.");
        
        try {
            if (!globalAuthToken || !globalNick) {
                showCustomMessage("Sessão expirada. Faça login novamente.");
                return;
            }

            // Buscar tarefas pendentes e expiradas
            const [pending, expired] = await Promise.all([
                callBackendEndpoint('tasks/pending', { auth_token: globalAuthToken, nick: globalNick }),
                callBackendEndpoint('tasks/expired', { auth_token: globalAuthToken, nick: globalNick })
            ]);

            batchTasksList.innerHTML = '';
            let allTasks = [...(pending.tasks || []), ...(expired.tasks || [])];

            if (allTasks.length === 0) {
                batchTasksList.innerHTML = '<p class="text-gray-400 text-center">Nenhuma tarefa encontrada.</p>';
                batchProcessingModal.classList.remove('hidden');
                return;
            }

            // Adicionar tarefas à lista
            allTasks.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = 'batch-task-item';
                taskItem.dataset.taskId = task.id;
                taskItem.innerHTML = `
                    <input type="checkbox" class="task-select-checkbox">
                    <span>${task.title || 'Título'}</span>
                    <label>
                        <input type="checkbox" class="save-draft-checkbox"> Salvar rascunho
                    </label>
                `;
                batchTasksList.appendChild(taskItem);
            });

            batchProcessingModal.classList.remove('hidden');
        } catch (err) {
            console.error(err);
            showCustomMessage(`Erro ao carregar tarefas: ${err.message}`);
        } finally {
            hideLoadingOverlay();
        }
    });

    // Event listeners para os botões de seleção em lote
    batchSelectAll.addEventListener('click', () => {
        batchTasksList.querySelectorAll('.task-select-checkbox').forEach(cb => cb.checked = true);
    });
    
    batchDeselectAll.addEventListener('click', () => {
        batchTasksList.querySelectorAll('.task-select-checkbox').forEach(cb => cb.checked = false);
        batchTasksList.querySelectorAll('.save-draft-checkbox').forEach(cb => cb.checked = false);
    });
    
    batchSelectAllDraft.addEventListener('click', () => {
        batchTasksList.querySelectorAll('.task-select-checkbox').forEach(cb => cb.checked = true);
        batchTasksList.querySelectorAll('.save-draft-checkbox').forEach(cb => cb.checked = true);
    });

    processSelectedTasksButton.addEventListener('click', async () => {
        const tasksToProcess = [];
        let roomNameForApplyBatch = null;

        // Coletar tarefas selecionadas
        batchTasksList.querySelectorAll('.batch-task-item').forEach(item => {
            const selectCheckbox = item.querySelector('.task-select-checkbox');
            const draftCheckbox = item.querySelector('.save-draft-checkbox');
            
            if (selectCheckbox.checked) {
                if (!roomNameForApplyBatch) {
                    roomNameForApplyBatch = item.dataset.roomNameForApply || null;
                }
                
                tasksToProcess.push({
                    task_id: item.dataset.taskId,
                    answer_id: '',
                    salvar_rascunho: draftCheckbox.checked ? 'true' : 'false'
                });
            }
        });

        if (tasksToProcess.length === 0) {
            showNotification("Nenhuma tarefa selecionada.", 'info');
            return;
        }

        closeBatchProcessingModal();
        tasksToProcess.forEach(t => processingTasks.add(t.task_id));

        showNotification(`Processando ${tasksToProcess.length} tarefa(s) em lote.`, 'info');

        try {
            const payload = {
                auth_token: globalAuthToken,
                room_name_for_apply: roomNameForApplyBatch,
                tasks: tasksToProcess
            };

            const response = await callBackendEndpoint('fazer_task', payload);

            if (response.success) {
                showNotification(`Tarefas em lote processadas com sucesso!`, 'success');
            } else {
                showNotification(`Erro ao processar tarefas em lote: ${response.message || 'Erro desconhecido.'}`, 'error');
            }
        } catch (error) {
            console.error("Erro ao processar tarefas em lote:", error);
            showNotification(`Erro ao processar tarefas em lote: ${error.message}`, 'error');
        } finally {
            tasksToProcess.forEach(t => processingTasks.delete(t.task_id));
            loadTasks(); // Recarregar tarefas após processamento
        }
    });

    // ------------------------------
    // AUTENTICAÇÃO
    // ------------------------------
    authForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const ra = document.getElementById('ra').value;
        const password = document.getElementById('password').value;

        loginModal.classList.add('hidden');
        showLoadingOverlay("Autenticando...", "Verificando suas credenciais.");

        try {
            // Chamar endpoint de autenticação
            const authResponse = await callBackendEndpoint('auth', {
                ra: ra,
                password: password
            });

            if (authResponse.success) {
                globalAuthToken = authResponse.user_info.auth_token;
                globalNick = authResponse.user_info.nick;
                globalExternalId = authResponse.user_info.external_id;

                // Armazenar dados do usuário
                sessionStorage.setItem('userData', JSON.stringify({
                    user_info: {
                        nick: globalNick,
                        auth_token: globalAuthToken,
                        external_id: globalExternalId,
                        name: authResponse.user_info.name || globalNick
                    }
                }));

                mainSection.classList.remove('hidden');
                loadTasks(); // Carregar tarefas após login
            } else {
                showNotification('RA ou senha inválidos', 'error', 4000);
                loginModal.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Erro durante o login:', error);
            showNotification('Erro de comunicação com o servidor', 'error', 4000);
            loginModal.classList.remove('hidden');
        } finally {
            hideLoadingOverlay();
        }
    });

    // ------------------------------
    // CARREGAMENTO DE TAREFAS
    // ------------------------------
    async function loadTasks() {
        showLoadingOverlay("Carregando Tarefas...", "Buscando suas tarefas.");
        
        try {
            if (!globalAuthToken || !globalNick) {
                throw new Error("Usuário não autenticado");
            }

            // Buscar tarefas pendentes
            const response = await callBackendEndpoint('tasks/pending', {
                auth_token: globalAuthToken,
                nick: globalNick
            });

            if (response.success && response.tasks) {
                renderTasks(response.tasks);
            } else {
                throw new Error(response.message || "Erro ao carregar tarefas");
            }
        } catch (error) {
            console.error("Erro ao carregar tarefas:", error);
            showNotification("Erro ao carregar tarefas: " + error.message, 'error');
            noTasks.classList.remove('hidden');
        } finally {
            hideLoadingOverlay();
        }
    }

    function renderTasks(tasks) {
        tasksContent.innerHTML = '';
        
        if (!tasks || tasks.length === 0) {
            noTasks.classList.remove('hidden');
            tasksContent.appendChild(noTasks);
            return;
        }
        
        noTasks.classList.add('hidden');
        
        tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'bg-gray-800 p-4 rounded-lg';
            taskElement.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-semibold">${task.title || 'Título Indisponível'}</h3>
                    <span class="text-sm px-2 py-1 rounded ${task.status === 'pending' ? 'bg-yellow-500' : 'bg-green-500'}">${task.status || 'Status'}</span>
                </div>
                <p class="text-gray-300 mb-3">${task.description || 'Descrição Indisponível'}</p>
                <div class="flex justify-between items-center text-sm text-gray-400">
                    <span>ID: ${task.id || 'N/A'}</span>
                    <button class="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded process-task" data-task-id="${task.id}">
                        Processar
                    </button>
                </div>
            `;
            
            tasksContent.appendChild(taskElement);
        });
        
        // Adicionar event listeners aos botões de processar
        document.querySelectorAll('.process-task').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = e.target.dataset.taskId;
                const task = tasks.find(t => t.id == taskId);
                if (task) {
                    openTaskProcessingModal(task);
                }
            });
        });
    }

    // ------------------------------
    // INICIALIZAÇÃO
    // ------------------------------
    function init() {
        // Verificar se já está logado
        const userData = sessionStorage.getItem('userData');
        if (userData) {
            try {
                const parsedData = JSON.parse(userData);
                globalAuthToken = parsedData.user_info.auth_token;
                globalNick = parsedData.user_info.nick;
                globalExternalId = parsedData.user_info.external_id;
                
                mainSection.classList.remove('hidden');
                loadTasks();
            } catch (error) {
                console.error("Erro ao recuperar dados da sessão:", error);
                sessionStorage.removeItem('userData');
                loginModal.classList.remove('hidden');
            }
        } else {
            loginModal.classList.remove('hidden');
        }
        
        // Configurar toggle de senha
        if (togglePasswordLogin) {
            togglePasswordLogin.addEventListener('click', togglePasswordVisibility);
        }
        
        // Configurar botão de fechar modais
        document.getElementById('closeBatchProcessingModal').addEventListener('click', closeBatchProcessingModal);
    }

    // Iniciar a aplicação
    init();
});
// ===== Seletores =====
const preloader = document.getElementById('preloader');
const mainSection = document.getElementById('mainSection');
const loginModal = document.getElementById('loginModal');
const authForm = document.getElementById('authForm');
const togglePassword = document.getElementById('togglePasswordLogin');
const passwordInput = document.getElementById('password');
const loadingOverlay = document.getElementById('loadingOverlay');
const notificationContainer = document.getElementById('notificationContainer');

// ===== Função para mostrar notificações =====
function showNotification(message, type = 'info', duration = 3000) {
    const notif = document.createElement('div');
    notif.className = `px-4 py-2 rounded shadow text-white ${type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`;
    notif.textContent = message;
    notificationContainer.appendChild(notif);
    setTimeout(() => notif.remove(), duration);
}

// ===== Toggle de senha =====
togglePassword.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    togglePassword.classList.toggle('fa-eye-slash');
});

// ===== Função para esconder preloader =====
function hidePreloader() {
    preloader.classList.add('hidden');
}

// ===== Login =====
authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const ra = document.getElementById('ra').value;
    const password = passwordInput.value;

    if(!ra || !password){
        showNotification('Preencha RA e senha!', 'error');
        return;
    }

    // Simular login
    loadingOverlay.classList.remove('hidden');
    setTimeout(() => {
        loadingOverlay.classList.add('hidden');
        loginModal.classList.add('hidden');
        mainSection.classList.remove('hidden');
        hidePreloader();
        showNotification('Login realizado com sucesso!');
    }, 1500);
});

// ===== Funções para modais de tarefas =====
function openModal(modal) {
    modal.classList.remove('hidden');
}
function closeModal(modal) {
    modal.classList.add('hidden');
}

// ===== Batch Processing Modals =====
const batchModal = document.getElementById('batchProcessingModal');
document.getElementById('processAllTasksButton')?.addEventListener('click', () => openModal(batchModal));
document.getElementById('closeBatchProcessingModal')?.addEventListener('click', () => closeModal(batchModal));

// ===== Task Processing Modal =====
const taskModal = document.getElementById('taskProcessingModal');
document.getElementById('doTaskButton')?.addEventListener('click', () => {
    showNotification('Tarefa concluída com sucesso!');
    closeModal(taskModal);
});
document.getElementById('saveDraftButton')?.addEventListener('click', () => {
    showNotification('Tarefa salva como rascunho!');
    closeModal(taskModal);
});

// ===== Simulação de carregamento inicial =====
window.addEventListener('load', () => {
    // Se você quiser que o preloader apareça mesmo após o login
    // setTimeout(hidePreloader, 1000);
    // Mas neste caso já escondemos no login
    console.log('Página carregada');
});
