'use strict';
/* CampusMate – all app logic. Sections: storage, dates, rendering, events. */

const STORAGE_KEY = 'campusmate.tasks';
const THEME_KEY = 'campusmate.theme';
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };
const PRIORITY_ICON = { High: '▲', Medium: '●', Low: '▼' };
const TIPS = ['Start with the hardest task while your mind is fresh.', 'Study in 25-minute blocks with 5-minute breaks.',
  'Break big assignments into small steps.', 'Review notes within 24 hours to remember more.', 'Sleep well – it helps memory more than cramming.'];

const $ = (id) => document.getElementById(id);
let tasks = loadTasks();
let editingId = null;     // id of the task being edited (null = adding new)
let pendingDeleteId = null;
const filters = { search: '', status: 'all', priority: 'all', sort: 'due' };

/* ---------- Storage ---------- */
// A stored task is only accepted if it has the fields the app needs.
function isValidTask(t) {
  return t && typeof t.id === 'string' && typeof t.title === 'string' && t.title.trim() !== '' &&
    /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) && t.priority in PRIORITY_RANK;
}
function loadTasks() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(data)) return [];           // missing or wrong shape -> start empty
    return data.filter(isValidTask).map((t) => ({
      ...t, subject: String(t.subject || 'General'), notes: String(t.notes || ''), completed: t.completed === true }));
  } catch (error) { return []; }                    // corrupted JSON -> start empty
}
function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  catch (error) { showToast('Could not save – browser storage is unavailable.'); }
}

/* ---------- Date helpers (local calendar dates, no time zones) ---------- */
function parseDate(dateString) { const [y, m, d] = dateString.split('-').map(Number); return new Date(y, m - 1, d); }
function daysUntil(dateString) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseDate(dateString) - today) / 86400000);
}
function formatDate(dateString) { return parseDate(dateString).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
function isRealDate(dateString) {   // rejects things like 2026-02-31
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const [y, m, d] = dateString.split('-').map(Number);
  const date = parseDate(dateString);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
// Returns { key, label } describing a task's deadline state. Completed tasks are never overdue.
function deadlineInfo(task) {
  if (task.completed) return { key: 'done', label: '✓ Completed' };
  const days = daysUntil(task.dueDate);
  if (days < 0) return { key: 'overdue', label: `⚠ Overdue by ${-days} day${days === -1 ? '' : 's'}` };
  if (days === 0) return { key: 'today', label: '⏰ Due today' };
  if (days <= 3) return { key: 'soon', label: `⏰ Due in ${days} day${days === 1 ? '' : 's'}` };
  return { key: 'later', label: `Due in ${days} days` };
}

/* ---------- Small DOM helper: builds elements and uses textContent (safe for user text) ---------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function byDueThenPriority(a, b) { return a.dueDate.localeCompare(b.dueDate) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]; }
function byPriorityThenDue(a, b) { return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.dueDate.localeCompare(b.dueDate); }

/* ---------- Rendering ---------- */
function renderStats() {
  const total = tasks.length, done = tasks.filter((t) => t.completed).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  $('statTotal').textContent = total; $('statDone').textContent = done;
  $('statPending').textContent = total - done; $('statPercent').textContent = percent + '%';
  $('progressFill').style.width = percent + '%';
  $('progressBar').setAttribute('aria-valuenow', percent);
}
function fillMiniList(listId, items, emptyText) {
  const list = $(listId); list.replaceChildren();
  if (!items.length) { list.append(el('li', 'muted', emptyText)); return; }
  items.forEach((task) => {
    const li = el('li');
    li.append(el('span', '', `${task.title} (${task.subject})`), el('span', 'badge ' + deadlineInfo(task).key, deadlineInfo(task).label));
    list.append(li);
  });
}
function renderDeadlines() {
  const pending = tasks.filter((t) => !t.completed).sort(byDueThenPriority);   // chronological
  fillMiniList('overdueList', pending.filter((t) => daysUntil(t.dueDate) < 0), 'Nothing overdue. Nice work!');
  fillMiniList('upcomingList', pending.filter((t) => daysUntil(t.dueDate) >= 0).slice(0, 5), 'No upcoming deadlines.');
}
function renderSubjects() {
  const box = $('subjectSummary'); box.replaceChildren();
  const groups = new Map();
  tasks.forEach((t) => {
    const key = t.subject.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: t.subject, total: 0, done: 0 });
    const group = groups.get(key); group.total++; if (t.completed) group.done++;
  });
  if (!groups.size) { box.append(el('p', 'muted', 'Add a task to see progress per subject.')); return; }
  groups.forEach((g) => {
    const row = el('div', 'subject-row');
    const bar = el('div', 'bar'); const fill = el('span'); fill.style.width = (g.done / g.total * 100) + '%'; bar.append(fill);
    row.append(el('strong', '', g.name), el('br'), el('small', '', `${g.done} of ${g.total} done`), bar);
    box.append(row);
  });
}
// Apply search + status + priority together, then sort.
function getVisibleTasks() {
  const query = filters.search.trim().toLowerCase();
  return tasks.filter((t) =>
    (!query || t.title.toLowerCase().includes(query) || t.subject.toLowerCase().includes(query)) &&
    (filters.status === 'all' || (filters.status === 'completed') === t.completed) &&
    (filters.priority === 'all' || t.priority === filters.priority)
  ).sort(filters.sort === 'priority' ? byPriorityThenDue : byDueThenPriority);
}
function buildTaskCard(task) {
  const info = deadlineInfo(task);
  const card = el('article', `card task-card ${info.key}`); card.dataset.id = task.id;
  const top = el('div', 'task-top'); const badges = el('div', 'badges');
  badges.append(el('span', 'badge ' + task.priority.toLowerCase(), `${PRIORITY_ICON[task.priority]} ${task.priority} priority`),
    el('span', 'badge ' + info.key, info.label));
  top.append(el('h3', '', task.title), badges);
  card.append(top, el('div', 'task-meta', `${task.subject} • Due ${formatDate(task.dueDate)}`));
  if (task.notes) card.append(el('p', 'task-notes', task.notes));
  const actions = el('div', 'task-actions');
  [['toggle', task.completed ? 'Reopen' : 'Mark complete'], ['edit', 'Edit'], ['delete', 'Delete']].forEach(([action, label]) => {
    const button = el('button', 'btn small' + (action === 'delete' ? ' danger' : ''), label);
    button.type = 'button'; button.dataset.action = action; actions.append(button);
  });
  card.append(actions);
  return card;
}
function renderTasks() {
  const visible = getVisibleTasks();
  $('taskList').replaceChildren(...visible.map(buildTaskCard));
  $('emptyState').hidden = visible.length > 0;
  if (!visible.length) {
    const noTasksYet = tasks.length === 0;
    $('emptyTitle').textContent = noTasksYet ? 'No tasks yet' : 'No tasks match';
    $('emptyText').textContent = noTasksYet ? 'Click "Add task" to create your first assignment or exam.' : 'Try a different search or clear the filters.';
  }
}
// One function refreshes everything, so statistics can never be out of date.
function render() { renderStats(); renderDeadlines(); renderSubjects(); renderTasks(); }

/* ---------- Task form ---------- */
function showToast(message) {
  const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}
function openTaskDialog(task) {
  editingId = task ? task.id : null;
  $('dialogTitle').textContent = task ? 'Edit task' : 'Add task';
  $('titleInput').value = task ? task.title : ''; $('subjectInput').value = task ? task.subject : '';
  $('dueInput').value = task ? task.dueDate : ''; $('priorityInput').value = task ? task.priority : 'Medium';
  $('notesInput').value = task ? task.notes : '';
  ['title', 'subject', 'due'].forEach((name) => { $(name + 'Error').textContent = ''; $(name + 'Input').removeAttribute('aria-invalid'); });
  $('saveBtn').disabled = false;
  $('taskDialog').showModal(); $('titleInput').focus();
}
function validateForm() {
  const problems = {
    title: $('titleInput').value.trim() ? '' : 'Enter a task title.',
    subject: $('subjectInput').value.trim() ? '' : 'Enter a subject or course.',
    due: !$('dueInput').value ? 'Choose a due date.' : isRealDate($('dueInput').value) ? '' : 'Enter a valid date.'
  };
  Object.entries(problems).forEach(([name, message]) => {
    $(name + 'Error').textContent = message;
    if (message) $(name + 'Input').setAttribute('aria-invalid', 'true'); else $(name + 'Input').removeAttribute('aria-invalid');
  });
  return Object.values(problems).every((message) => !message);
}
function handleFormSubmit(event) {
  event.preventDefault();
  if ($('saveBtn').disabled || !validateForm()) return;   // blocks double submissions
  $('saveBtn').disabled = true;
  const values = { title: $('titleInput').value.trim(), subject: $('subjectInput').value.trim(), dueDate: $('dueInput').value,
    priority: $('priorityInput').value, notes: $('notesInput').value.trim() };
  if (editingId) {
    tasks = tasks.map((t) => (t.id === editingId ? { ...t, ...values } : t)); showToast('Task updated');
  } else {
    tasks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), completed: false, ...values }); showToast('Task added');
  }
  saveTasks(); render(); $('taskDialog').close();
}

/* ---------- Events ---------- */
function handleTaskAction(event) {
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const id = button.closest('.task-card').dataset.id; const task = tasks.find((t) => t.id === id); if (!task) return;
  if (button.dataset.action === 'toggle') {
    task.completed = !task.completed; saveTasks(); render(); showToast(task.completed ? 'Marked complete' : 'Task reopened');
  } else if (button.dataset.action === 'edit') { openTaskDialog(task); }
  else { pendingDeleteId = id; $('confirmText').textContent = `"${task.title}" will be removed permanently.`; $('confirmDialog').showModal(); }
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('themeToggle').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  $('themeToggle').setAttribute('aria-pressed', theme === 'dark');
  try { localStorage.setItem(THEME_KEY, theme); } catch (error) { /* theme just won't be remembered */ }
}
function init() {
  const hour = new Date().getHours();
  $('greeting').textContent = (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening') + ', ready to plan your day?';
  $('studyTip').textContent = 'Tip: ' + TIPS[new Date().getDate() % TIPS.length];
  let savedTheme = null; try { savedTheme = localStorage.getItem(THEME_KEY); } catch (error) { /* ignore */ }
  setTheme(savedTheme === 'dark' ? 'dark' : 'light');

  $('addTaskBtn').addEventListener('click', () => openTaskDialog(null));
  $('cancelBtn').addEventListener('click', () => $('taskDialog').close());
  $('taskForm').addEventListener('submit', handleFormSubmit);
  $('taskList').addEventListener('click', handleTaskAction);
  $('themeToggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('confirmCancel').addEventListener('click', () => $('confirmDialog').close());
  $('confirmDelete').addEventListener('click', () => {
    tasks = tasks.filter((t) => t.id !== pendingDeleteId); saveTasks(); render(); $('confirmDialog').close(); showToast('Task deleted');
  });
  $('searchInput').addEventListener('input', (e) => { filters.search = e.target.value; renderTasks(); });
  $('statusFilter').addEventListener('change', (e) => { filters.status = e.target.value; renderTasks(); });
  $('priorityFilter').addEventListener('change', (e) => { filters.priority = e.target.value; renderTasks(); });
  $('sortSelect').addEventListener('change', (e) => { filters.sort = e.target.value; renderTasks(); });
  render();
}
init();
