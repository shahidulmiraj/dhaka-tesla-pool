import { AuthCard } from '@/components/AuthCard';
import { LoginForm } from '@/features/auth/LoginForm';

export default function LoginPage() {
  return (
    <AuthCard title="Sign in" description="Passengers and drivers use the same sign-in.">
      <LoginForm />
    </AuthCard>
  );
}
