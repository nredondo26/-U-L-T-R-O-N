import { Router } from 'express';
import { register, login, getProfile } from './auth.controller';
import { authenticate } from './auth.middleware';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/profile', authenticate, getProfile);
