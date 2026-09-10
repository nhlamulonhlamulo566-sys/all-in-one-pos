'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth, initiateEmailSignIn } from '@/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof formSchema>;

export function LoginForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      if (!auth) throw new Error('Auth not initialized');
      await initiateEmailSignIn(auth, data.email, data.password);
      toast({
        title: 'Login Successful!',
        description: "You've been successfully logged in.",
      });
      router.push('/');
    } catch (error: any) {
      if (error.message === 'Auth not initialized') {
        toast({
          variant: 'destructive',
          title: 'Auth Not Ready',
          description: 'Authentication is not ready. Please refresh the page and try again.'
        });
        setIsLoading(false);
        return;
      }
      let description = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/invalid-credential') {
        description = 'Invalid email or password. Please check your credentials.';
        // Clear password field on failed attempt
        form.reset({
          email: data.email, // keep the email
          password: '', // clear the password
        });
      } else {
        // Log other, unexpected errors
        console.error(error);
      }
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: description,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function resendPasswordSetup() {
    const email = form.getValues('email');
    const parsedEmail = z.string().email().safeParse(email);
    if (!parsedEmail.success) {
      toast({ variant: 'destructive', title: 'Enter your email first', description: 'Type the account email to receive a password setup link.' });
      return;
    }
    if (email.trim().toLowerCase() === 'jeff@gmail.com') {
      toast({ variant: 'destructive', title: 'Protected account', description: 'Password recovery for the protected super administrator is disabled here.' });
      return;
    }
    try {
      if (!auth) throw new Error('Auth not initialized');
      await sendPasswordResetEmail(auth, email);
      toast({ title: 'Password setup email sent', description: 'Check your inbox and follow the Firebase link to choose a password.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Unable to send email', description: error.code === 'auth/user-not-found' ? 'No account was found for that email.' : 'Please check the email and try again.' });
    }
  }

  return (
    <Card className="mx-auto w-full max-w-sm shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>
          Enter your email below to login to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="m@example.com"
                      {...field}
                      autoComplete="email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      autoComplete="current-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
            <Button type="button" variant="link" className="w-full" onClick={resendPasswordSetup}>
              Set or reset my password
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center text-sm text-muted-foreground px-4">
          Don&apos;t have an account? Please contact your manager to have one created for you.
        </div>
      </CardContent>
    </Card>
  );
}
