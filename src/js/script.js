taskProcessingModal.classList.add('open');  
        }  

        // Fecha o modal de processamento de tarefa (Individual)  
        function closeTaskProcessingModalHandler() {  
            taskProcessingModal.classList.remove('open');  
        }  

        // NOVO: Função para exibir notificações  
        function showNotification(message, type = 'info', duration = 3000) {  
            const notificationItem = document.createElement('div');  
            notificationItem.className = `notification-item ${type}`;  
            let iconHtml = '';  
            if (type === 'info') {  
                iconHtml = '<i class="fas fa-info-circle icon" style="color: var(--primary-light);"></i>';  
            } else if (type === 'warning') {  
                iconHtml = '<i class="fas fa-exclamation-triangle icon" style="color: var(--warning);"></i>';  
            } else if (type === 'success') {  
                iconHtml = '<i class="fas fa-check-circle icon" style="color: var(--success);"></i>';  
            } else if (type === 'error') {  
                iconHtml = '<i class="fas fa-times-circle icon" style="color: var(--error);"></i>';  
            }  

            notificationItem.innerHTML = `${iconHtml}<span class="message">${message}</span>`;  
            notificationContainer.appendChild(notificationItem);  

            // Força o reflow para garantir a transição  
            void notificationItem.offsetWidth;  
            notificationItem.classList.add('show');  

            setTimeout(() => {  
                notificationItem.classList.remove('show');  
                notificationItem.classList.add('hide');  
                notificationItem.addEventListener('transitionend', () => {  
                    notificationItem.remove();  
                }, { once: true });  
            }, duration);  
        }  

        // NOVO: Função refatorada para lidar com o processamento de tarefas (individual)  
        async function handleIndividualTaskProcessing(isDraft = false) {  
            const taskId = taskProcessingModal.dataset.taskId;  
            const roomNameForApply = taskProcessingModal.dataset.roomNameForApply;  
            const answerId = taskProcessingModal.dataset.answerId;  
            const minTime = minTimeInput.value;  
            const maxTime = maxTimeInput.value;  
            const taskName = modalProcessingTitle.textContent.replace('Processando Tarefa: ', '');  

            // VERIFICAÇÃO DE SEGURANÇA  
            if (processingTasks.has(taskId)) {  
                showNotification(`A tarefa "${taskName}" já está sendo processada.`, 'warning');  
                return;  
            }  

            closeTaskProcessingModalHandler();  
            processingTasks.add(taskId); // Adiciona ao set para bloquear novas requisições  
            renderTasks(JSON.parse(sessionStorage.getItem('currentTasks') || '[]'), sessionStorage.getItem('currentFilter')); // Re-renderiza para mostrar o status  

            const actionText = isDraft ? 'salva como rascunho' : 'enviada';  
            const processingActionText = isDraft ? 'salvando como rascunho' : 'processada';  

            showNotification(`Tarefa "${taskName}" está sendo ${processingActionText}.`, 'info');  
            showNotification(`A tarefa "${taskName}" irá demorar de ${minTime || 'N/A'} a ${maxTime || 'N/A'} minutos.`, 'warning', 5000);  

            try {  
                const payload = {  
                    auth_token: globalAuthToken,  
                    room_name_for_apply: roomNameForApply || null,  
                    time_min: minTime,  
                    time_max: maxTime,  
                    tasks: [{  
                        task_id: taskId,  
                        answer_id: answerId || null,  
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
                console.error(`Erro ao processar tarefa (rascunho: ${isDraft}):`, error);  
                showNotification(`Erro ao processar tarefa "${taskName}": ${error.message}`, 'error');  
            } finally {  
                processingTasks.delete(taskId); // Libera o bloqueio da tarefa  
                applyFilter(sessionStorage.getItem('currentFilter') || 'todo'); // Recarrega as tarefas para refletir a mudança final  
            }  
        }  

        doTaskButton.addEventListener('click', () => handleIndividualTaskProcessing(false));  
        saveDraftButton.addEventListener('click', () => handleIndividualTaskProcessing(true));  

        // NOVO: Abre o modal de processamento em lote  
        processAllTasksButton.addEventListener('click', async () => {  
            showLoadingOverlay("Carregando Tarefas...", "Buscando tarefas pendentes e expiradas para processamento em lote.");  
            try {  
                const userDataString = sessionStorage.getItem('userData');  
                if (!userDataString) {  
                    showCustomMessage("Sessão expirada ou dados de usuário ausentes. Por favor, faça login novamente.", () => {  
                        window.location.href = 'login-alunos';  
                    });  
                    return;  
                }  
                const userData = JSON.parse(userDataString);  
                const { nick, auth_token } = userData.user_info;  

                // Buscar tarefas pendentes e expiradas simultaneamente  
                const [pendingTasksResponse, expiredTasksResponse] = await Promise.all([  
                    callBackendEndpoint('tasks/pending', { auth_token, nick }),  
                    callBackendEndpoint('tasks/expired', { auth_token, nick })  
                ]);  

                batchTasksList.innerHTML = ''; // Limpa a lista anterior  

                let allTasks = [];  

                // Processar tarefas pendentes  
                if (pendingTasksResponse.success && pendingTasksResponse.tasks && Array.isArray(pendingTasksResponse.tasks)) {  
                    allTasks = [...allTasks, ...pendingTasksResponse.tasks.map(task => ({ ...task, taskType: 'pending' }))];  
                }  

                // Processar tarefas expiradas  
                if (expiredTasksResponse.success && expiredTasksResponse.tasks && Array.isArray(expiredTasksResponse.tasks)) {  
                    allTasks = [...allTasks, ...expiredTasksResponse.tasks.map(task => ({ ...task, taskType: 'expired' }))];  
                }  

                if (allTasks.length > 0) {  
                    // Ordenar por tipo (pendentes primeiro) e depois por título  
                    allTasks.sort((a, b) => {  
                        if (a.taskType !== b.taskType) {  
                            return a.taskType === 'pending' ? -1 : 1;  
                        }  
                        return (a.title || '').localeCompare(b.title || '');  
                    });  

                    // Adicionar seção de estatísticas no topo da lista  
                    const statsDiv = document.createElement('div');  
                    statsDiv.className = 'batch-stats';  
                    const pendingCount = allTasks.filter(t => t.taskType === 'pending').length;  
                    const expiredCount = allTasks.filter(t => t.taskType === 'expired').length;  
                    const draftCount = allTasks.filter(t => t.answer_status === 'draft').length;  
                      
                    statsDiv.innerHTML = `  
                        <p class="stats-text">  
                            <strong>Total: ${allTasks.length} tarefas</strong> |   
                            Pendentes: ${pendingCount} |   
                            Expiradas: ${expiredCount} |   
                            Rascunhos: ${draftCount}  
                        </p>  
                    `;  
                    batchTasksList.appendChild(statsDiv); // Adiciona antes dos itens  

                    allTasks.forEach(task => {  
                        const taskItem = document.createElement('div');  
                        taskItem.className = 'batch-task-item';  
                        taskItem.dataset.taskId = task.id;  
                        taskItem.dataset.answerId = (task.answer_status === 'draft' && task.answer_id !== null) ? task.answer_id : '';  
                        taskItem.dataset.roomNameForApply = task.room_name_for_apply || '';  
                        taskItem.dataset.taskType = task.taskType;  

                        const isCurrentlyProcessing = processingTasks.has(task.id);  

                        // Determinar o status visual  
                        let statusBadge = '';  
                        let statusClass = '';  
                        if (task.taskType === 'expired') {  
                            statusBadge = '<span class="status-badge expired">Expirada</span>';  
                            statusClass = 'expired-task';  
                        } else if (task.answer_status === 'draft') {  
                            statusBadge = '<span class="status-badge draft">Rascunho</span>';  
                            statusClass = 'draft-task';  
                        } else {  
                            statusBadge = '<span class="status-badge pending">Pendente</span>';  
                            statusClass = 'pending-task';  
                        }  

                        if (isCurrentlyProcessing) {  
                            statusBadge = '<span class="status-badge processing">Processando...</span>';  
                            statusClass += ' processing-task';  
                        }  

                        taskItem.innerHTML = `  
                            <div class="task-item-content ${statusClass}">  
                                <input type="checkbox" class="task-select-checkbox" ${isCurrentlyProcessing ? 'disabled' : ''}>  
                                <div class="task-info">  
                                    <span class="task-name">${task.title || 'Título Indisponível'}</span>  
                                    ${statusBadge}  
                                </div>  
                                <label class="draft-option">  
                                    <input type="checkbox" class="save-draft-checkbox" ${task.answer_status === 'draft' ? 'checked' : ''} ${isCurrentlyProcessing ? 'disabled' : ''}>   
                                    Salvar como rascunho  
                                </label>  
                            </div>  
                        `;  
                        batchTasksList.appendChild(taskItem);  
                    });  
                      
                } else {  
                    batchTasksList.innerHTML = '<p class="text-gray-500 text-center">Nenhuma tarefa pendente ou expirada encontrada.</p>';  
                }  
                  
                batchProcessingModal.classList.add('open');  
            } catch (error) {  
                console.error("Erro ao carregar tarefas para processamento em lote:", error);  
                showCustomMessage(`Erro ao carregar tarefas: ${error.message}`);  
            } finally {  
                hideLoadingOverlay();  
            }  
        });  

        // NOVO: Handler para o botão "Selecionar Todas" no modal de lote  
        batchSelectAll.addEventListener('click', () => {  
            const checkboxes = batchTasksList.querySelectorAll('.task-select-checkbox');  
            checkboxes.forEach(checkbox => {  
                if (!checkbox.disabled) {  
                    checkbox.checked = true;  
                }  
            });  
        });  

        // NOVO: Handler para o botão "Todas como Rascunho" no modal de lote  
        batchSelectAllDraft.addEventListener('click', () => {  
            const taskItems = batchTasksList.querySelectorAll('.batch-task-item');  
            taskItems.forEach(item => {  
                const selectCheckbox = item.querySelector('.task-select-checkbox');  
                const draftCheckbox = item.querySelector('.save-draft-checkbox');  
                if (!selectCheckbox.disabled && !draftCheckbox.disabled) {  
                    selectCheckbox.checked = true;  
                    draftCheckbox.checked = true;  
                }  
            });  
        });  

        // NOVO: Handler para o botão "Limpar Seleção" no modal de lote  
        batchDeselectAll.addEventListener('click', () => {  
            const checkboxes = batchTasksList.querySelectorAll('.task-select-checkbox');  
            checkboxes.forEach(checkbox => {  
                checkbox.checked = false;  
            });  
            const draftCheckboxes = batchTasksList.querySelectorAll('.save-draft-checkbox');  
            draftCheckboxes.forEach(checkbox => {  
                checkbox.checked = false;  
            });  
        });  

        // NOVO: Handler para o botão "Processar Tarefas Selecionadas" no modal de lote  
        processSelectedTasksButton.addEventListener('click', async () => {  
            const tasksToProcess = [];  
            const taskItems = batchTasksList.querySelectorAll('.batch-task-item');  
            const globalMinTime = batchMinTimeInput.value;  
            const globalMaxTime = batchMaxTimeInput.value;  

            let roomNameForApplyBatch = null;  

            taskItems.forEach(item => {  
                const checkbox = item.querySelector('.task-select-checkbox');  
                if (checkbox.checked && !checkbox.disabled) {  
                    const taskId = item.dataset.taskId;  
                    // VERIFICAÇÃO DE SEGURANÇA (redundante, mas bom ter)  
                    if (processingTasks.has(taskId)) {  
                        const taskName = item.querySelector('.task-name').textContent;  
                        showNotification(`Tarefa "${taskName}" já está em processamento e foi ignorada.`, 'warning');  
                        return; // Pula para a próxima iteração  
                    }  

                    if (!roomNameForApplyBatch) {  
                        roomNameForApplyBatch = item.dataset.roomNameForApply || null;  
                    }  

                    const answerId = item.dataset.answerId;  
                    const salvarRascunho = item.querySelector('.save-draft-checkbox').checked ? 'true' : 'false';  

                    tasksToProcess.push({  
                        task_id: taskId,  
                        answer_id: answerId || null,  
                        salvar_rascunho: salvarRascunho  
                    });  
                }  
            });  

            if (tasksToProcess.length === 0) {  
                showNotification("Nenhuma tarefa válida selecionada para processar.", 'info');  
                return;  
            }  

            batchProcessingModal.classList.remove('open'); // Fecha o modal de lote  

            const taskIdsToProcess = tasksToProcess.map(t => t.task_id);  
            taskIdsToProcess.forEach(id => processingTasks.add(id)); // Adiciona todos ao set de bloqueio  
            renderTasks(JSON.parse(sessionStorage.getItem('currentTasks') || '[]'), sessionStorage.getItem('currentFilter')); // Re-renderiza a lista principal  

            showNotification(`Processando ${tasksToProcess.length} tarefa(s) em lote.`, 'info');  
            showNotification(`As tarefas irão demorar de ${globalMinTime || 'N/A'} a ${globalMaxTime || 'N/A'} minutos.`, 'warning', 5000);  

            try {  
                const payload = {  
                    auth_token: globalAuthToken,  
                    room_name_for_apply: roomNameForApplyBatch,  
                    time_min: globalMinTime,  
                    time_max: globalMaxTime,  
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
                taskIdsToProcess.forEach(id => processingTasks.delete(id)); // Remove todos do set de bloqueio  
                applyFilter(sessionStorage.getItem('currentFilter') || 'todo'); // Recarrega as tarefas para refletir as mudanças finais  
            }  
        });  


        // Abre o modal de respostas e exibe as respostas  
        async function showTaskAnswers(taskId) {  
            showLoadingOverlay("Carregando Respostas...", "Buscando as respostas da tarefa.");  
            deliveredTaskModal.classList.remove('open'); // Fecha o modal de entregues se estiver aberto  

            try {  
                const userDataString = sessionStorage.getItem('userData');  
                if (!userDataString) {  
                    console.error("Dados do usuário não encontrados na sessão.");  
                    // Usando um modal customizado em vez de alert  
                    showCustomMessage("Sessão expirada ou dados de usuário ausentes. Por favor, faça login novamente.", () => {  
                        window.location.href = 'login-alunos';  
                    });  
                    return;  
                }  
                const userData = JSON.parse(userDataString);  
                const { auth_token } = userData.user_info;  

                const response = await callBackendEndpoint('fazer_task', {  
                    action: 'mostrar_respostas',  
                    task_id: taskId,  
                    auth_token: auth_token // Passa o token do aluno  
                });  

                if (response.success && response.answers) {  
                    answersContent.innerHTML = ''; // Limpa o conteúdo anterior  

                    const answers = response.answers;  
                    if (Object.keys(answers).length === 0) {  
                        answersContent.innerHTML = '<p class="text-gray-400">Nenhuma resposta encontrada para esta tarefa.</p>';  
                    } else {  
                        for (const questionId in answers) {  
                            const answerData = answers[questionId];  
                            const questionBlock = document.createElement('div');  
                            questionBlock.className = 'question-block';  

                            let answerHtml = '';  
                            if (answerData.question_type === 'multiple_choice' || answerData.question_type === 'single' || answerData.question_type === 'multi' || answerData.question_type === 'true-false') {  
                                // Para questões de múltipla escolha/verdadeiro-falso, mostra as opções corretas  
                                const correctOptions = Object.entries(answerData.answer)  
                                    .filter(([, isCorrect]) => isCorrect)  
                                    .map(([index]) => `Opção ${parseInt(index) + 1}`) // Ajusta para 1-based index  
                                    .join(', ');  
                                answerHtml = `<p class="correct-answer"><strong>Resposta Correta:</strong> ${correctOptions || 'N/A'}</p>`;  
                            } else if (answerData.question_type === 'fill-words' && Array.isArray(answerData.answer)) {  
                                // Para fill-words, exibe as palavras extraídas  
                                answerHtml = `<p class="correct-answer"><strong>Palavras Corretas:</strong> ${answerData.answer.join(', ')}</p>`;  
                            } else if (answerData.question_type === 'essay' || answerData.question_type === 'text_ai' || answerData.question_type === 'fill-letters') {  
                                // Para redação/texto AI/fill-letters, exibe o texto  
                                answerHtml = `<p class="correct-answer"><strong>Resposta Correta:</strong> ${answerData.answer['0'] || 'N/A'}</p>`;  
                            } else {  
                                answerHtml = `<p class="correct-answer"><strong>Resposta:</strong> ${JSON.stringify(answerData.answer)}</p>`;  
                            }  

                            questionBlock.innerHTML = `  
                                <h4>Questão ID: ${answerData.question_id} (Tipo: ${answerData.question_type})</h4>  
                                ${answerHtml}  
                            `;  
                            answersContent.appendChild(questionBlock);  
                        }  
                    }  
                    answersModal.classList.add('open');  
                } else {  
                    showCustomMessage(`Erro ao carregar respostas: ${response.message || 'Resposta inválida do servidor.'}`);  
                }  
            } catch (error) {  
                console.error("Erro ao mostrar respostas da tarefa:", error);  
                showCustomMessage(`Erro ao carregar respostas: ${error.message}`);  
            } finally {  
                hideLoadingOverlay();  
            }  
        }  

        // Fecha o modal de respostas  
        function closeAnswersModalHandler() {  
            answersModal.classList.remove('open');  
        }  

        // Função para exibir mensagens customizadas (substituindo alert)  
        function showCustomMessage(message, callback = null) {  
            const messageBox = document.createElement('div');  
            messageBox.style.cssText = `  
                position: fixed;  
                top: 50%;  
                left: 50%;  
                transform: translate(-50%, -50%);  
                background-color: var(--background-light);  
                color: var(--text-primary);  
                padding: 20px;  
                border-radius: 10px;  
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);  
                z-index: 2000;  
                text-align: center;  
                max-width: 80%;  
                border: 1px solid var(--border);  
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

        // Função para mostrar o overlay de carregamento com título e mensagem dinâmicos  
        function showLoadingOverlay(title, message) {  
            loadingTitle.textContent = title;  
            loadingMessage.textContent = message;  
            loadingOverlay.classList.add('visible');  
            mainSection.classList.add('blurred-content');  
        }  

        // Função para esconder o overlay de carregamento  
        function hideLoadingOverlay() {  
            loadingOverlay.classList.remove('visible');  
            mainSection.classList.remove('blurred-content');  
        }  


        // Aplica o filtro de status nas tarefas  
        async function applyFilter(status) {  
            let tasksToRender = [];  
            showLoadingOverlay("Carregando Tarefas...", "Buscando tarefas para o status selecionado.");  
            sessionStorage.setItem('currentFilter', status); // Salva o filtro atual  

            try {  
                const userDataString = sessionStorage.getItem('userData');  
                if (!userDataString) {  
                    // Se não houver dados de usuário na sessão, redireciona para o login  
                    window.location.href = 'login-alunos';  
                    return;  
                }  
                const userData = JSON.parse(userDataString);  
                const { nick, auth_token } = userData.user_info;  

                let tasksResponse;  
                if (status === 'todo') {  
                    tasksResponse = await callBackendEndpoint('tasks/pending', { auth_token, nick });  
                } else if (status === 'delivered') {  
                    tasksResponse = await callBackendEndpoint('tasks/entregues', { auth_token, nick });  
                } else if (status === 'expired') {  
                    tasksResponse = await callBackendEndpoint('tasks/expired', { auth_token, nick });  
                } else {  
                    // Padrão para 'todo' se o status for desconhecido  
                    tasksResponse = await callBackendEndpoint('tasks/pending', { auth_token, nick });  
                }  

                if (tasksResponse.success && tasksResponse.tasks && Array.isArray(tasksResponse.tasks)) {  
                    tasksToRender = tasksResponse.tasks;  
                } else if (tasksResponse.success && tasksResponse.tasks_entregues && Array.isArray(tasksResponse.tasks_entregues)) {  
                    tasksToRender = tasksResponse.tasks_entregues;  
                }  
                else {  
                    console.error(`Falha ao carregar tarefas para o status ${status}:`, tasksResponse.message);  
                    tasksToRender = [];  
                }  
                  
                sessionStorage.setItem('currentTasks', JSON.stringify(tasksToRender)); // Salva as tarefas atuais  
                renderTasks(tasksToRender, status);  

                filterToDo.classList.toggle('selected', status === 'todo');  
                filterDelivered.classList.toggle('selected', status === 'delivered');  
                filterExpired.classList.toggle('selected', status === 'expired');  

                const statusMap = { todo: 'A fazer', delivered: 'Entregues', expired: 'Expiradas' };  
                toDoButton.textContent = statusMap[status] || 'Filtro';  

            } catch (error) {  
                console.error("Erro ao aplicar filtro ou buscar tarefas entregues:", error);  
                tasksToRender = [];  
                renderTasks(tasksToRender, status);  
            } finally {  
                hideLoadingOverlay();  
            }  
        }  

        // Renderiza os cartões de tarefas  
        function renderTasks(tasksToRender, currentFilterStatus) {  
            tasksContent.innerHTML = '';  

            if (!tasksToRender || tasksToRender.length === 0) {  
                noTasks.classList.remove('hidden');  
                tasksContent.appendChild(noTasks);  
                return;  
            } else {  
                noTasks.classList.add('hidden');  
            }  

            tasksToRender.forEach(task => {  
                const container = document.createElement('div');  
                container.className = 'task-card-container';  

                const card = document.createElement('div');  
                card.className = 'task-card';  

                card.addEventListener('mouseenter', () => {  
                    card.classList.add('expandido');  
                });  
                card.addEventListener('mouseleave', () => {  
                    card.classList.remove('expandido');  
                });  

                const isDelivered = currentFilterStatus === 'delivered' || (task.status === 'finished' || task.status === 'submitted');  
                const taskIdDisplay = isDelivered ? task.task_id : (task.id || 'N/A');  

                const primaryCategoryId = isDelivered && task.task_category_ids && task.task_category_ids.length > 0  
                                        ? task.task_category_ids[0]  
                                        : (task.category_ids && task.category_ids.length > 0 ? task.category_ids[0] : null);  
                const subjectName = primaryCategoryId ? categoryMap[primaryCategoryId] || `Componente ${primaryCategoryId}` : 'Componente Indefinido';  

                let statusText = 'Pendente';  
                if (processingTasks.has(taskIdDisplay)) {  
                    statusText = 'Sendo Processado';  
                } else if (isDelivered) {  
                    statusText = 'Entregue';  
                } else if (task.type === 'expired') {  
                    statusText = 'Expirada';  
                } else if (task.answer_status === 'draft') {  
                    statusText = 'Rascunho';  
                } else {  
                    statusText = 'A fazer';  
                }  

                let daysInfo = '';  
                let progressPercentage = 0;  
                const now = new Date();  

                const expireDate = isDelivered && task.task_expire_at ? new Date(task.task_expire_at) : (task.expire_at ? new Date(task.expire_at) : null);  
                const publishDate = isDelivered && task.task_publish_at ? new Date(task.task_publish_at) : (task.publish_at ? new Date(task.publish_at) : null);  

                if (!isDelivered && expireDate) {  
                    const diffTime = expireDate.getTime() - now.getTime();  
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));  

                    if (diffDays > 0) {  
                        daysInfo = `${diffDays} dias`;  
                        if (publishDate) {  
                            const totalDuration = expireDate.getTime() - publishDate.getTime();  
                            const elapsedDuration = now.getTime() - publishDate.getTime();  
                            progressPercentage = Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100));  
                        }  
                    } else {  
                        daysInfo = 'Expirado';  
                        progressPercentage = 100;  
                    }  
                } else {  
                    daysInfo = '';  
                    progressPercentage = 100;  
                }  

                let daysInfoColorClass = 'text-success';  
                if (daysInfo === 'Expirado') {  
                    daysInfoColorClass = 'text-error';  
                } else if (daysInfo === 'Sem prazo') {  
                    daysInfoColorClass = 'text-secondary';  
                } else if (isDelivered) {  
                    daysInfoColorClass = 'text-primary-light';  
                }  

                const taskTitle = isDelivered ? task.task_title : (task.title || 'Título Indisponível');  
                const taskDescription = isDelivered ? task.task_description : (task.description || 'Nenhuma descrição disponível.');  
                  
                const firstAccessDate = task.apply_moment_first_apply_at || task.accessed_on;  
                const taskScore = task.result_score !== undefined && task.result_score !== null ? task.result_score : 'N/A';  
                const deliveredAtDate = task.delivered_at;  

                const roomNameForApply = task.room_name_for_apply || '';  
                const answerIdForProcessing = (task.answer_status === 'draft' && task.answer_id !== null) ? task.answer_id : '';  
                const buttonText = isDelivered ? 'Visualizar Tarefa' : 'Processar tarefas';  

                card.dataset.taskId = taskIdDisplay;  
                card.dataset.answerId = task.answer_id || '';  

                card.innerHTML = `  
                    <div class="flex flex-col h-full">  
                        <div>  
                            <div class="task-card-header">  
                                <p class="task-card-subject">${subjectName}</p>  
                                <span class="task-card-status">${statusText}</span>  
                            </div>  
                            <p class="task-card-title" title="${taskTitle}">${taskTitle}</p>  
                        </div>  

                        <div class="task-card-details-on-hover">  
                            ${isDelivered ? `  
                                <p class="mb-2"><strong>Nota:</strong> ${taskScore}</p>  
                                <p class="mb-2"><strong>Entregue em:</strong> ${formatDateTime(deliveredAtDate)}</p>  
                                <p class="mb-2"><strong>ID da Tarefa:</strong> ${taskIdDisplay}</p>  
                            ` : `  
                                <p class="mb-2">${taskDescription}</p>  
                                <div class="text-xs space-y-1">  
                                    <hr class="border-gray-700 my-2">  
                                    <p><b>ID da tarefa:</b> ${taskIdDisplay}</p>  
                                    <p><b>Primeiro Acesso:</b> ${formatDateTime(firstAccessDate)}</p>  
                                    ${task.delivered_at ? `<p><b>Data de Entrega:</b> ${formatDateTime(task.delivered_at)}</p>` : ''}  
                                    ${task.result_score !== undefined && task.result_score !== null ? `<p><b>Pontuação:</b> ${task.result_score}</p>` : ''}  
                                </div>  
                            `}  
                        </div>  

                        <div class="mt-auto pt-2">  
                            ${!isDelivered ? `  
                            <div class="task-card-dates">  
                                <span>${formatDate(publishDate)}</span>  
                                <div class="task-card-progress-bar-container">  
                                    <p class="task-card-days-remaining ${daysInfoColorClass}">${daysInfo}</p>  
                                    <div class="task-card-progress-bar">  
                                        <div class="task-card-progress-bar-fill" style="width: ${progressPercentage}%;"></div>  
                                    </div>  
                                </div>  
                                <span>${formatDate(expireDate)}</span>  
                            </div>  
                            ` : `  
                            <div class="task-card-dates">  
                                <span class="${daysInfoColorClass}">${daysInfo}</span>  
                            </div>  
                            `}  

                            <button class="task-proceed-button"  
                                data-task-id="${taskIdDisplay}"  
                                data-is-delivered="${isDelivered}"  
                                data-answer-id="${answerIdForProcessing}"  
                                data-room-name-for-apply="${roomNameForApply}"  
                                data-task-name="${taskTitle}">  
                                ${buttonText}  
                            </button>  
                        </div>  
                    </div>  
                `;  
                container.appendChild(card);  
                tasksContent.appendChild(container);  

                const proceedButton = card.querySelector('.task-proceed-button');  
                if (proceedButton) {  
                    // Se a tarefa estiver em processamento, atualiza o estilo do card e o estado do botão  
                    if (processingTasks.has(taskIdDisplay)) {  
                        card.classList.add('processing');  
                        proceedButton.disabled = true;  
                        proceedButton.textContent = 'Processando...';  
                    }  

                    proceedButton.addEventListener('click', (e) => {  
                        const clickedTaskId = e.currentTarget.dataset.taskId;  
                          
                        // Verificação de segurança para evitar múltiplas ações  
                        if (processingTasks.has(clickedTaskId)) {  
                            showNotification('Esta tarefa já está sendo processada.', 'warning');  
                            return;  
                        }  

                        const clickedTaskIsDelivered = e.currentTarget.dataset.isDelivered === 'true';  
                        const selectedTask = tasksToRender.find(t => (t.id || t.task_id) == clickedTaskId);  

                        if (clickedTaskIsDelivered) {  
                            openDeliveredTaskModal(selectedTask);  
                        } else {  
                            openTaskProcessingModal(selectedTask);  
                        }  
                    });  
                }  
            });  
        }  


        // --- Função Principal de Carregamento de Dados da Página (após login bem-sucedido) ---  
        async function loadPageData() {  
            showLoadingOverlay("Carregando Dados...", "Preparando sua página de tarefas.");  
            // mainSection.classList.remove('hidden'); // Isso é tratado após a autenticação  

            try {  
                const userDataString = sessionStorage.getItem('userData');  
                if (!userDataString) {  
                    window.location.href = 'login-alunos'; // Redireciona se não houver dados de usuário  
                    return;  
                }  
                const userData = JSON.parse(userDataString);  
                const { external_id, name, nick, auth_token } = userData.user_info;  
                const userName = name || nick || 'Usuário';  

                globalAuthToken = auth_token; // Define globalAuthToken  
                globalNick = nick; // Define globalNick  
                globalExternalId = external_id; // Define globalExternalId  

                // Removido a lógica de exibição de avatar e nome de usuário na UI, pois o header foi removido  

                applyFilter('todo'); // Carrega as tarefas iniciais  
            } catch (error) {  
                console.error("Erro fatal ao carregar as tarefas:", error);  
                noTasks.classList.remove('hidden');  
                tasksContent.appendChild(noTasks);  
            } finally {  
                hideLoadingOverlay();  
            }  
        }  

        // --- Envio do Formulário de Autenticação (do expansao.php) ---  
        authForm.addEventListener('submit', async function(event) {  
            event.preventDefault();  

            const ra = document.getElementById('ra').value;  
            const password = document.getElementById('password').value;  

            loginModal.classList.remove('active'); // Oculta o modal de login  
            showLoadingOverlay("Autenticando...", "Verificando suas credenciais.");  

            globalProcessId = `auth_process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;  

            try {  
                // Chamando o endpoint '/auth' do seu servidor Python  
                const authResponse = await callBackendEndpoint('auth', {  
                    ra: ra,  
                    password: password  
                }, PYTHON_SERVER_URL);  

                if (authResponse.success) {  
                    globalAuthToken = authResponse.user_info.auth_token;  
                    globalNick = authResponse.user_info.nick;  
                    globalExternalId = authResponse.user_info.external_id;  

                    // Armazena os dados do usuário na sessionStorage  
                    sessionStorage.setItem('userData', JSON.stringify({  
                        user_info: {  
                            nick: globalNick,  
                            auth_token: globalAuthToken,  
                            external_id: globalExternalId,  
                            name: authResponse.user_info.name || globalNick  
                        }  
                    }));  

                    mainSection.classList.remove('hidden'); // Mostra o dashboard principal  
                    loadPageData(); // Carrega o conteúdo do dashboard  
                } else {  
                    console.error('Erro na autenticação:', authResponse.message);  
                      
                    // CORREÇÃO: Verifica se é erro 401 (não autorizado) para mostrar mensagem amigável  
                    let errorMessage = 'RA ou senha inválidos';  
                      
                    // Se a mensagem contém informações sobre 401/Unauthorized, usa mensagem amigável  
                    if (authResponse.message &&   
                        (authResponse.message.includes('401') ||   
                        authResponse.message.toLowerCase().includes('unauthorized') ||  
                        authResponse.message.toLowerCase().includes('client error'))) {  
                        errorMessage = 'RA ou senha inválidos';  
                    } else if (authResponse.message) {  
                        // Para outros tipos de erro, pode mostrar a mensagem original  
                        errorMessage = authResponse.message;  
                    }  
                      
                    // Mostra notificação de erro e reexibe o modal de login  
                    showNotification(errorMessage, 'error', 4000);  
                    loginModal.classList.add('active');  
                    mainSection.classList.add('hidden'); // Garante que o dashboard permaneça oculto  
                }  

            } catch (error) {  
                console.error('Erro de rede ou servidor durante o login:', error);  
                  
                // CORREÇÃO: Verifica se o erro é relacionado a credenciais inválidas  
                let errorMessage = 'Erro de comunicação com o servidor';  
                  
                if (error.message &&   
                    (error.message.includes('401') ||   
                    error.message.toLowerCase().includes('unauthorized'))) {  
                    errorMessage = 'RA ou senha inválidos';  
                }  
                  
                showNotification(errorMessage, 'error', 4000);  
                loginModal.classList.add('active');  
                mainSection.classList.add('hidden');  
            } finally {  
                hideLoadingOverlay();  
            }  
        });  


        // --- Listeners de Eventos do tarefas.php ---  
        function performLogout() {  
            sessionStorage.clear();  
            window.location.href = 'login-alunos'; // Redireciona para uma página de login genérica  
        }  
        // Removidos listeners de logout da sidebar e profile menu  
        // Removidos listeners do menu toggle button, sidebar overlay, sidebar logo, user profile button e profile menu  

        toDoButton.addEventListener('click', (e) => {  
            e.stopPropagation();  
            statusFilterDropdown.classList.toggle('open');  
        });  

        filterToDo.addEventListener('click', () => {  
            applyFilter('todo');  
            statusFilterDropdown.classList.remove('open');  
        });  

        filterDelivered.addEventListener('click', () => {  
            applyFilter('delivered');  
            statusFilterDropdown.classList.remove('open');  
        });  

        filterExpired.addEventListener('click', () => {  
            applyFilter('expired');  
            statusFilterDropdown.classList.remove('open');  
        });  

        document.addEventListener('click', (e) => {  
            if (!statusFilterDropdown.contains(e.target) && !toDoButton.contains(e.target)) {  
                statusFilterDropdown.classList.remove('open');  
            }  
        });  

        closeDeliveredTaskModal.addEventListener('click', closeDeliveredTaskModalHandler);  
        deliveredTaskModal.addEventListener('click', (e) => {  
            if (e.target === deliveredTaskModal) {  
                closeDeliveredTaskModalHandler();  
            }  
        });  

        // NOVO: Listener para fechar o modal de processamento de tarefa clicando fora  
        taskProcessingModal.addEventListener('click', (e) => {  
            if (e.target === taskProcessingModal) {  
                closeTaskProcessingModalHandler();  
            }  
        });  

        // NOVO: Listener para fechar o modal de processamento em lote clicando fora  
        batchProcessingModal.addEventListener('click', (e) => {  
            if (e.target === batchProcessingModal) {  
                batchProcessingModal.classList.remove('open');  
            }  
        });  

        // Listener para o botão "Visualizar Resposta" dentro do modal de tarefas entregues  
        viewResponseButton.addEventListener('click', (e) => {  
            const taskId = e.currentTarget.dataset.taskId;  
            if (taskId) {  
                showTaskAnswers(taskId);  
            } else {  
                showCustomMessage("ID da tarefa não encontrado para visualizar a resposta.");  
            }  
        });  

        // Listener para fechar o modal de respostas  
        closeAnswersModal.addEventListener('click', closeAnswersModalHandler);  
        answersModal.addEventListener('click', (e) => {  
            if (e.target === answersModal) {  
                closeAnswersModalHandler();  
            }  
        });  


        // --- Lógica de Responsividade (do tarefas.php) ---  
        function checkScreenSize() {  
            // A lógica de responsividade para sidebar e header foi removida  
            // pois eles não existem mais nesta versão da página de tarefas.  
        }  

        // --- Inicializações ---  
        checkScreenSize();  
        window.addEventListener('resize', checkScreenSize);  

        // Alternar visibilidade da senha (do expansao.php)  
        if (togglePasswordLogin) {  
            togglePasswordLogin.addEventListener('click', () => togglePasswordVisibility('password'));  
        }  

        // Desempenho: Pausar animações quando não visível (do expansao.php)  
        document.addEventListener('visibilitychange', () => {  
            const particles = document.querySelectorAll('.particle');  
            particles.forEach(particle => {  
                particle.style.animationPlayState = document.hidden ? 'paused' : 'running';  
            });  
        });  
    });  

    // Função para alternar a visibilidade da senha  
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

