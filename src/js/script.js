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
    const deliveredTaskModal = document.getElementById('deliveredTaskModal');
    const answersModal = document.getElementById('answersModal');
    const answersContent = document.getElementById('answersContent');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingTitle = document.getElementById('loadingTitle');
    const loadingMessage = document.getElementById('loadingMessage');
    const mainSection = document.getElementById('mainSection');

    const doTaskButton = document.getElementById('doTaskButton');
    const saveDraftButton = document.getElementById('saveDraftButton');
    const processAllTasksButton = document.getElementById('processAllTasksButton');
    const processSelectedTasksButton = document.getElementById('processSelectedTasksButton');

    const batchTasksList = document.getElementById('batchTasksList');
    const batchSelectAll = document.getElementById('batchSelectAll');
    const batchSelectAllDraft = document.getElementById('batchSelectAllDraft');
    const batchDeselectAll = document.getElementById('batchDeselectAll');
    const batchMinTimeInput = document.getElementById('batchMinTimeInput');
    const batchMaxTimeInput = document.getElementById('batchMaxTimeInput');

    const authForm = document.getElementById('authForm');
    const loginModal = document.getElementById('loginModal');
    const togglePasswordLogin = document.getElementById('togglePasswordLogin');

    const toDoButton = document.getElementById('toDoButton');
    const filterToDo = document.getElementById('filterToDo');
    const filterDelivered = document.getElementById('filterDelivered');
    const filterExpired = document.getElementById('filterExpired');
    const statusFilterDropdown = document.getElementById('statusFilterDropdown');

    const closeDeliveredTaskModal = document.getElementById('closeDeliveredTaskModal');
    const viewResponseButton = document.getElementById('viewResponseButton');
    const closeAnswersModal = document.getElementById('closeAnswersModal');

    const minTimeInput = document.getElementById('minTimeInput');
    const maxTimeInput = document.getElementById('maxTimeInput');
    const modalProcessingTitle = document.getElementById('modalProcessingTitle');

    // ------------------------------
    // FUNÇÕES UTILITÁRIAS
    // ------------------------------

    // Simulação de requisição para backend
    async function callBackendEndpoint(endpoint, payload, serverUrl = '') {
        // Aqui você substituirá para Railway
        console.log(`Chamando endpoint ${endpoint} com payload:`, payload);
        return { success: true, message: 'OK', tasks: [], tasks_entregues: [], answers: {} };
    }

    function showNotification(message, type = 'info', duration = 3000) {
        const notificationContainer = document.getElementById('notificationContainer');
        if (!notificationContainer) return;

        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${type}`;
        let iconHtml = '';
        if (type === 'info') iconHtml = '<i class="fas fa-info-circle icon" style="color: #3498db;"></i>';
        else if (type === 'warning') iconHtml = '<i class="fas fa-exclamation-triangle icon" style="color: #f39c12;"></i>';
        else if (type === 'success') iconHtml = '<i class="fas fa-check-circle icon" style="color: #2ecc71;"></i>';
        else if (type === 'error') iconHtml = '<i class="fas fa-times-circle icon" style="color: #e74c3c;"></i>';

        notificationItem.innerHTML = `${iconHtml}<span class="message">${message}</span>`;
        notificationContainer.appendChild(notificationItem);
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
            <button id="messageBoxCloseButton" class="btn-primary px-4 py-2 rounded-md">OK</button>
        `;
        document.body.appendChild(messageBox);

        document.getElementById('messageBoxCloseButton').addEventListener('click', () => {
            document.body.removeChild(messageBox);
            if (callback) callback();
        });
    }

    function showLoadingOverlay(title, message) {
        loadingTitle.textContent = title;
        loadingMessage.textContent = message;
        loadingOverlay.classList.add('visible');
        mainSection.classList.add('blurred-content');
    }

    function hideLoadingOverlay() {
        loadingOverlay.classList.remove('visible');
        mainSection.classList.remove('blurred-content');
    }

    function formatDate(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
    }

    function formatDateTime(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${d.getHours()}:${d.getMinutes()}`;
    }

    function togglePasswordVisibility(id) {
        const input = document.getElementById(id);
        const icon = input.nextElementSibling;
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    // ------------------------------
    // MODAIS
    // ------------------------------
    function closeTaskProcessingModalHandler() { taskProcessingModal.classList.remove('open'); }
    function closeDeliveredTaskModalHandler() { deliveredTaskModal.classList.remove('open'); }
    function closeAnswersModalHandler() { answersModal.classList.remove('open'); }

    taskProcessingModal.addEventListener('click', (e) => { if (e.target === taskProcessingModal) closeTaskProcessingModalHandler(); });
    batchProcessingModal.addEventListener('click', (e) => { if (e.target === batchProcessingModal) batchProcessingModal.classList.remove('open'); });
    deliveredTaskModal.addEventListener('click', (e) => { if (e.target === deliveredTaskModal) closeDeliveredTaskModalHandler(); });
    answersModal.addEventListener('click', (e) => { if (e.target === answersModal) closeAnswersModalHandler(); });

    closeDeliveredTaskModal.addEventListener('click', closeDeliveredTaskModalHandler);
    closeAnswersModal.addEventListener('click', closeAnswersModalHandler);

    // ------------------------------
    // PROCESSAMENTO INDIVIDUAL
    // ------------------------------
    async function handleIndividualTaskProcessing(isDraft = false) {
        const taskId = taskProcessingModal.dataset.taskId;
        if (!taskId) return;
        if (processingTasks.has(taskId)) {
            showNotification(`Esta tarefa já está sendo processada.`, 'warning');
            return;
        }

        closeTaskProcessingModalHandler();
        processingTasks.add(taskId);
        renderTasks(JSON.parse(sessionStorage.getItem('currentTasks') || '[]'), sessionStorage.getItem('currentFilter'));

        const actionText = isDraft ? 'salva como rascunho' : 'enviada';
        const processingActionText = isDraft ? 'salvando como rascunho' : 'processada';
        const taskName = modalProcessingTitle.textContent || 'Tarefa';

        showNotification(`Tarefa "${taskName}" está sendo ${processingActionText}.`, 'info');

        try {
            const payload = {
                auth_token: globalAuthToken,
                room_name_for_apply: taskProcessingModal.dataset.roomNameForApply || null,
                tasks: [{ task_id: taskId, answer_id: taskProcessingModal.dataset.answerId || null, salvar_rascunho: isDraft.toString() }]
            };
            const response = await callBackendEndpoint('fazer_task', payload);

            if (response.success) showNotification(`Tarefa "${taskName}" ${actionText} com sucesso!`, 'success');
            else showNotification(`Erro ao processar tarefa "${taskName}": ${response.message || 'Erro desconhecido.'}`, 'error');
        } catch (error) {
            console.error(error);
            showNotification(`Erro ao processar tarefa "${taskName}": ${error.message}`, 'error');
        } finally {
            processingTasks.delete(taskId);
            applyFilter(sessionStorage.getItem('currentFilter') || 'todo');
        }
    }

    doTaskButton.addEventListener('click', () => handleIndividualTaskProcessing(false));
    saveDraftButton.addEventListener('click', () => handleIndividualTaskProcessing(true));

    // ------------------------------
    // PROCESSAMENTO EM LOTE
    // ------------------------------
    processAllTasksButton.addEventListener('click', async () => {
        showLoadingOverlay("Carregando Tarefas...", "Buscando tarefas pendentes e expiradas.");
        try {
            const userDataString = sessionStorage.getItem('userData');
            if (!userDataString) {
                showCustomMessage("Sessão expirada. Faça login novamente.", () => window.location.href = 'login-alunos');
                return;
            }
            const { nick, auth_token } = JSON.parse(userDataString).user_info;

            const [pending, expired] = await Promise.all([
                callBackendEndpoint('tasks/pending', { auth_token, nick }),
                callBackendEndpoint('tasks/expired', { auth_token, nick })
            ]);

            batchTasksList.innerHTML = '';
            let allTasks = [...(pending.tasks || []), ...(expired.tasks || [])];

            if (allTasks.length === 0) {
                batchTasksList.innerHTML = '<p class="text-gray-500 text-center">Nenhuma tarefa encontrada.</p>';
                batchProcessingModal.classList.add('open');
                return;
            }

            allTasks.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = 'batch-task-item';
                taskItem.dataset.taskId = task.id;
                taskItem.innerHTML = `
                    <input type="checkbox" class="task-select-checkbox">
                    <span>${task.title || 'Título'}</span>
                    <input type="checkbox" class="save-draft-checkbox"> Salvar rascunho
                `;
                batchTasksList.appendChild(taskItem);
            });

            batchProcessingModal.classList.add('open');
        } catch (err) {
            console.error(err);
            showCustomMessage(`Erro ao carregar tarefas: ${err.message}`);
        } finally {
            hideLoadingOverlay();
        }
    });

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

        batchTasksList.querySelectorAll('.batch-task-item').forEach(item => {
            const selectCheckbox = item.querySelector('.task-select-checkbox');
            const draftCheckbox = item.querySelector('.save-draft-checkbox');
            if (selectCheckbox.checked) {
                if (!roomNameForApplyBatch) roomNameForApplyBatch = item.dataset.roomNameForApply || null;
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

        batchProcessingModal.classList.remove('open');
        tasksToProcess.forEach(t => processingTasks.add(t.task_id));

        showNotification(`Processando ${tasksToProcess.length} tarefa(s) em lote.`, 'info');

        try {
            const payload = { auth_token: globalAuthToken, room_name_for_apply: roomNameForApply
