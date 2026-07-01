import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const defaultFilter = { status: 'all', priority: 'all', sortBy: 'createdAt', order: 'desc' };
const API_URL = import.meta.env.VITE_API_URL || 'https://task-management-tool-wn5f.onrender.com/api/tasks';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://task-management-tool-wn5f.onrender.com';

function App() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', status: 'pending', priority: 'medium', dueDate: '' });
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState(defaultFilter);
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((text, kind = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ text, kind });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  }, []);

  const hasActiveFilters = filter.status !== defaultFilter.status || filter.priority !== defaultFilter.priority || filter.sortBy !== defaultFilter.sortBy || filter.order !== defaultFilter.order;

  const applyTaskChange = useCallback((action, payload) => {
    setTasks((current) => {
      switch (action) {
        case 'created':
          return current.some((task) => task._id === payload._id)
            ? current.map((task) => (task._id === payload._id ? payload : task))
            : [payload, ...current];
        case 'updated':
          return current.map((task) => (task._id === payload._id ? payload : task));
        case 'deleted':
          return current.filter((task) => task._id !== payload.id);
        default:
          return current;
      }
    });
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      showToast('Live updates connected', 'info');
    });

    socket.on('connect_error', () => {
      showToast('Live updates unavailable', 'info');
    });

    socket.on('task:update', ({ action, payload }) => {
      applyTaskChange(action, payload);
      showToast(`Task ${action} from server`, 'success');
    });

    return () => socket.disconnect();
  }, [applyTaskChange, showToast]);

  const fetchTasks = useCallback(async (currentFilter = filter, options = {}) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentFilter.status !== 'all') params.append('status', currentFilter.status);
      if (currentFilter.priority !== 'all') params.append('priority', currentFilter.priority);
      params.append('sortBy', currentFilter.sortBy);
      params.append('order', currentFilter.order);
      const res = await fetch(`${API_URL}?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');
      setTasks(data);
      if (options.showMessage !== false) {
        showToast(options.message || 'Tasks loaded', 'success');
      }
    } catch (error) {
      if (options.showMessage !== false) {
        showToast(error.message || 'Unable to load tasks.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [filter, showToast]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchTasks(filter, { showMessage: false });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchTasks, filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || form.title.trim().length < 3) {
      showToast('Title must be at least 3 characters.', 'error');
      return;
    }

    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, title: form.title.trim(), description: form.description.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');
      setForm({ title: '', description: '', status: 'pending', priority: 'medium', dueDate: '' });
      setEditingId(null);
      applyTaskChange(editingId ? 'updated' : 'created', data);
      await fetchTasks(filter, { showMessage: false });
      showToast(editingId ? 'Task updated.' : 'Task created.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleEdit = (task) => {
    setEditingId(task._id);
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : ''
    });
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      applyTaskChange('deleted', { id });
      await fetchTasks(filter, { showMessage: false });
      showToast('Task deleted.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleResetFilters = () => {
    setFilter(defaultFilter);
    showToast('Filters reset', 'info');
  };

  return (
    <div className="app-shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">MERN Stack Task Tracker</p>
          <h1>Plan work, track progress, and finish faster.</h1>
          <p className="subtitle">Create, update, filter, and manage tasks from one responsive dashboard.</p>
        </div>
      </header>

      {toast && (
        <div className={`toast-stack`}>
          <div className={`toast ${toast.kind}`}>{toast.text}</div>
        </div>
      )}

      <main className="dashboard">
        <section className="panel form-panel">
          <h2>{editingId ? 'Edit Task' : 'Add a New Task'}</h2>
          <form onSubmit={handleSubmit} className="task-form">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" rows="3" />
            <div className="row">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            <button type="submit">{editingId ? 'Update Task' : 'Create Task'}</button>
          </form>
        </section>

        <section className="panel list-panel">
          <div className="toolbar">
            <h2>Your Tasks</h2>
            <div className="filters">
              <select className={filter.status !== defaultFilter.status ? 'filter-select active' : 'filter-select'} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <select className={filter.priority !== defaultFilter.priority ? 'filter-select active' : 'filter-select'} value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })}>
                <option value="all">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select className={filter.sortBy !== defaultFilter.sortBy ? 'filter-select active' : 'filter-select'} value={filter.sortBy} onChange={(e) => setFilter({ ...filter, sortBy: e.target.value })}>
                <option value="createdAt">Date</option>
                <option value="priority">Priority</option>
                <option value="dueDate">Due Date</option>
              </select>
              <select className={filter.order !== defaultFilter.order ? 'filter-select active' : 'filter-select'} value={filter.order} onChange={(e) => setFilter({ ...filter, order: e.target.value })}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
              <button type="button" className={`filter-reset-btn ${hasActiveFilters ? 'active' : ''}`} onClick={handleResetFilters}>
                Reset filters
              </button>
            </div>
          </div>

          {isLoading ? <p>Loading tasks...</p> : tasks.length === 0 ? <p>No tasks found.</p> : <div className="task-list">
            {tasks.map((task) => (
              <article key={task._id} className="task-card">
                <div>
                  <div className="task-title-row">
                    <h3>{task.title}</h3>
                    <span className={`pill ${task.priority}`}>{task.priority}</span>
                  </div>
                  <p>{task.description || 'No description provided.'}</p>
                  <div className="meta">
                    <span>Status: {task.status}</span>
                    <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</span>
                  </div>
                </div>
                <div className="actions">
                  <button onClick={() => handleEdit(task)}>Edit</button>
                  <button className="danger" onClick={() => handleDelete(task._id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>}
        </section>
      </main>
    </div>
  );
}

export default App;
