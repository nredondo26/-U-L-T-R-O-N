const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'db.json');

// Helper: leer base de datos
function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

// Helper: escribir base de datos
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/tasks - Obtener todas las tareas
router.get('/', (req, res) => {
  const db = readDB();
  const { status } = req.query;

  let tasks = db.tasks;
  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }

  res.json(tasks);
});

// GET /api/tasks/:id - Obtener una tarea por ID
router.get('/:id', (req, res) => {
  const db = readDB();
  const task = db.tasks.find((t) => t.id === req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  res.json(task);
});

// POST /api/tasks - Crear una nueva tarea
router.post('/', (req, res) => {
  const { title, description } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'El título es obligatorio' });
  }

  const db = readDB();

  const newTask = {
    id: uuidv4(),
    title: title.trim(),
    description: description ? description.trim() : '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  db.tasks.push(newTask);
  writeDB(db);

  res.status(201).json(newTask);
});

// PUT /api/tasks/:id - Actualizar una tarea
router.put('/:id', (req, res) => {
  const db = readDB();
  const index = db.tasks.findIndex((t) => t.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const { title, description, status } = req.body;
  const task = db.tasks[index];

  if (title !== undefined) task.title = title.trim();
  if (description !== undefined) task.description = description.trim();
  if (status !== undefined) task.status = status;

  db.tasks[index] = task;
  writeDB(db);

  res.json(task);
});

// DELETE /api/tasks/:id - Eliminar una tarea
router.delete('/:id', (req, res) => {
  const db = readDB();
  const index = db.tasks.findIndex((t) => t.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const deleted = db.tasks.splice(index, 1)[0];
  writeDB(db);

  res.json({ message: 'Tarea eliminada', task: deleted });
});

module.exports = router;
