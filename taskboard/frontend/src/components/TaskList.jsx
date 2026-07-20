import { useState, useEffect, useCallback } from 'react';

const STATUS_ORDER = ['pending', 'in-progress', 'done'];
const STATUS_LABELS = {
  pending: 'Pendiente',
  'in-progress': 'En progreso',
  done: 'Completada',
};

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nextStatus(current) {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('Error al cargar tareas');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleAdvanceStatus = async (task) => {
    const newStatus = nextStatus(task.status);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Cargando tareas...</div>;

  return (
    <div className="task-list">
      {error && <div className="error-message">{error}</div>}

      {tasks.length === 0 ? (
        <div className="empty-state">
          <p>No hay tareas todavía</p>
          <p className="sub">Crea tu primera tarea usando el formulario de arriba</p>
        </div>
      ) : (
        tasks.map((task) => (
          <div className="task-card" key={task.id}>
            <div className="task-card-content">
              <div className="task-card-title">{task.title}</div>
              {task.description && (
                <div className="task-card-desc">{task.description}</div>
              )}
              <div className="task-card-meta">
                <span className={`task-status ${task.status}`}>
                  {STATUS_LABELS[task.status] || task.status}
                </span>
                <span className="task-date">{formatDate(task.createdAt)}</span>
              </div>
            </div>
            <div className="task-actions">
              <button
                className="btn-action btn-status"
                onClick={() => handleAdvanceStatus(task)}
                title="Avanzar estado"
              >
                {STATUS_LABELS[nextStatus(task.status)]}
              </button>
              <button
                className="btn-action btn-delete"
                onClick={() => handleDelete(task.id)}
                title="Eliminar tarea"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
