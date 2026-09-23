'use client';

import { useMutation } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from './api';
import { useSession } from './useMe';

// Synthetic demo accounts from the seed (README "Demo credentials").
const DEMO = [
  { name: 'Nusrat', email: 'nusrat@teslapool.demo' },
  { name: 'Rafiq', email: 'rafiq@teslapool.demo' },
  { name: 'Shirin', email: 'shirin@teslapool.demo' },
  { name: 'Jashim (driver)', email: 'jashim@teslapool.demo' },
];
const DEMO_PASSWORD = 'Dhaka2026!';

export function LoginForm() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({ mutationFn: () => login(email, password), onSuccess: session.start });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>{mutation.error.message}</AlertDescription>
        </Alert>
      )}
      <fieldset disabled={mutation.isPending} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" size="lg">
          {mutation.isPending && <Loader2Icon className="animate-spin" aria-hidden />}
          Sign in
        </Button>
      </fieldset>
      <p className="text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
      <div className="rounded-lg bg-muted/60 p-3 text-sm">
        <p className="mb-2 text-muted-foreground">Demo accounts (password {DEMO_PASSWORD}):</p>
        <div className="flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <Button
              key={d.email}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEmail(d.email);
                setPassword(DEMO_PASSWORD);
              }}
            >
              {d.name}
            </Button>
          ))}
        </div>
      </div>
    </form>
  );
}
