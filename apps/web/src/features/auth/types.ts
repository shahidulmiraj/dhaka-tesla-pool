export type Role = 'PASSENGER' | 'DRIVER';

export interface Me {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  walletBalancePaisa: number;
  isOnline: boolean;
  vehicle: { id: string; name: string; capacity: number } | null;
}

export interface Session {
  token: string;
  user: Me;
}

export interface SignupInput {
  email: string;
  password: string;
  fullName: string;
  role: Role;
  vehicle?: { name: string; capacity: number };
}
