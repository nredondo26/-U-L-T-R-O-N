import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../shared/prisma';
import { AuthRequest } from '../types';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { AppError, ValidationError } from '../shared/errors';

const registerSchema = z.object({
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export async function register(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }

    const { name, email, password, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'El email ya está registrado');
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
}

export async function login(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(401, 'Credenciales inválidas');
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      throw new AppError(401, 'Credenciales inválidas');
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'No autenticado');

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) throw new AppError(404, 'Usuario no encontrado');

    res.json({ user });
  } catch (error) {
    next(error);
  }
}
