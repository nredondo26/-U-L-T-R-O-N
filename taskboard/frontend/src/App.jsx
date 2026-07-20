import { useState, useCallback } from 'react';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import './App.css';

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTaskCreated = useCallback(() => {
    // Incrementa la clave para forzar el re-render de TaskList
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="app-container">
      <h1 className="app-title">
        <span>Task</span>Board
      </h1>

      <TaskForm onTaskCreated={handleTaskCreated} />

      {/* key cambia para refrescar la lista cuando se crea una tarea */}
      <TaskList key={refreshKey} />
    </div>
  );
}
