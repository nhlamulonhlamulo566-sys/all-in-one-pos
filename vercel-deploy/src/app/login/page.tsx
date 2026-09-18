import Image from 'next/image';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center gap-2 text-foreground">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-transparent">
          <Image
            src="/00.png"
            alt="All In One POS logo"
            width={120}
            height={120}
            priority
            className="h-16 w-auto object-contain"
          />
        </div>
        <span className="text-2xl font-semibold tracking-tight">All In One POS</span>
      </div>
      <LoginForm />
    </div>
  );
}
