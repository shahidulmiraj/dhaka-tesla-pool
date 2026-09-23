import { api } from '@/lib/api-client';
import type { Me, Session, SignupInput } from './types';

export const login = (email: string, password: string) =>
  api<Session>('/auth/login', { method: 'POST', body: { email, password } });
export const signup = (input: SignupInput) => api<Session>('/auth/signup', { method: 'POST', body: input });
export const getMe = () => api<Me>('/auth/me');
