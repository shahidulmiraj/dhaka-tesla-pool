import { AuthCard } from '@/components/AuthCard';
import { RegisterForm } from '@/features/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <AuthCard title="Create an account" description="Drivers register their Tesla and its fixed seat count.">
      <RegisterForm />
    </AuthCard>
  );
}
