// ================================
// Configurações do frontend
// ================================
const API_URLS = [
  "https://trollchipss-tarefas.onrender.com",   // servidor principal (Render)
  "http://127.0.0.1:5000",                        // opção local (dev)
  "https://trollchipss-tarefas.onrender.com"     // fallback
];

let currentApiUrl = API_URLS[0];

// ================================
// Funções utilitárias
// ================================
async function callBackendEndpoint(endpoint, body = {}, method = "POST") {
  for (let url of API_URLS) {
    try {
      const response = await fetch(`${url}/${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        currentApiUrl = url; // servidor válido encontrado
        return data;
      }
    } catch (err) {
      console.warn(`Falha em ${url}/${endpoint}:`, err.message);
      continue; // tenta próximo servidor
    }
  }
  throw new Error("Nenhum servidor respondeu corretamente.");
}

// ================================
// Funções de autenticação
// ================================
async function login(username, password) {
  return await callBackendEndpoint("auth", { username, password });
}

// ================================
// Funções de tarefas
// ================================
async function getPendingTasks(authToken) {
  return await callBackendEndpoint("tasks", { auth_token: authToken, filter: "pending" });
}

async function getExpiredTasks(authToken) {
  return await callBackendEndpoint("tasks", { auth_token: authToken, filter: "expired" });
}

// ================================
// Funções de UI
// ================================
function displayTasksInSelectionModal(tasks) {
  const modal = document.getElementById("modal");
  const taskList = document.getElementById("taskList");
  const selectAllCheckbox = document.getElementById("selectAll");

  taskList.innerHTML = "";
  selectAllCheckbox.checked = false;

  if (!tasks || tasks.length === 0) {
    taskList.innerHTML = "<li>Nenhuma tarefa encontrada.</li>";
  } else {
    tasks.forEach((task) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <label>
          <input type="checkbox" value="${task.id}" />
          ${task.title}
        </label>
      `;
      taskList.appendChild(li);
    });
  }

  modal.classList.remove("hidden");
}

// ================================
// Listeners
// ================================
document.addEventListener("DOMContentLoaded", async () => {
  const modal = document.getElementById("modal");
  const closeModal = document.getElementById("closeModal");
  const selectAllCheckbox = document.getElementById("selectAll");

  // Fechar modal
  closeModal.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  // Selecionar todos
  selectAllCheckbox.addEventListener("change", () => {
    const checkboxes = modal.querySelectorAll("input[type='checkbox']:not(#selectAll)");
    checkboxes.forEach((cb) => (cb.checked = selectAllCheckbox.checked));
  });

  // Login + carregar tarefas automaticamente
  try {
    const loginResult = await login("usuario_teste", "senha_teste");

    if (loginResult.auth_token) {
      const tasksResult = await getPendingTasks(loginResult.auth_token);
      displayTasksInSelectionModal(tasksResult.tasks);
    }
  } catch (err) {
    console.error("Erro ao carregar tarefas:", err.message);
  }
});
