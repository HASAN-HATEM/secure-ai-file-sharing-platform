import { Role } from './auth';

export function assertRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role)) {
    throw new Error('Forbidden');
  }
}
