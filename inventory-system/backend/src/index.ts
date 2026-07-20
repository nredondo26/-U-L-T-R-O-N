import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './auth/auth.routes';
import { productRouter } from './products/product.routes';
import { categoryRouter } from './categories/category.routes';
import { movementRouter } from './movements/movement.routes';
import { reportRouter } from './reports/report.routes';

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares globales
app.use(helmet());
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/movements', movementRouter);
app.use('/api/reports', reportRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware de errores (debe ir al final)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Servidor ULTRON Inventory corriendo en puerto ${PORT}`);
});

export default app;
