'use client';

import { useMutation } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signup } from './api';
import type { Role } from './types';
import { useSession } from './useMe';

export function RegisterForm() {
  const session = useSession();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'PASSENGER' as Role,
    vehicleName: 'Bullet',
    capacity: 3,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const mutation = useMutation({
    mutationFn: () =>
      signup({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        vehicle: form.role === 'DRIVER' ? { name: form.vehicleName, capacity: form.capacity } : undefined,
      }),
    onSuccess: session.start,
  });

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
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">I am a</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['PASSENGER', 'DRIVER'] as const).map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-primary/5"
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={form.role === r}
                  onChange={() => set('role', r)}
                  className="accent-primary"
                />
                {r === 'PASSENGER' ? 'Passenger' : 'Driver with a Tesla'}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            required
            maxLength={80}
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            aria-describedby="password-hint"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 8 characters.
          </p>
        </div>
        {form.role === 'DRIVER' && (
          <div className="grid grid-cols-[1fr_7rem] gap-3 rounded-lg border p-3">
            <div className="space-y-1.5">
              <Label htmlFor="vehicleName">Vehicle name</Label>
              <Input
                id="vehicleName"
                required
                maxLength={40}
                value={form.vehicleName}
                onChange={(e) => set('vehicleName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacity">Seats</Label>
              <Input
                id="capacity"
                type="number"
                required
                min={1}
                max={6}
                value={form.capacity}
                onChange={(e) => set('capacity', Number(e.target.value))}
              />
            </div>
          </div>
        )}
        <Button type="submit" className="w-full" size="lg">
          {mutation.isPending && <Loader2Icon className="animate-spin" aria-hidden />}
          Create account
        </Button>
      </fieldset>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
