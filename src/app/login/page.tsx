import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-brand-700">Tampal</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Tamworth Christadelphian Church
        </p>
      </div>
      <LoginForm />
      <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
        Accounts are invite-only. Ask an administrator to add you.
      </p>
      <p className="mt-2 text-center text-sm">
        <a href="/privacy" className="text-brand-700 underline">
          Privacy notice
        </a>
      </p>
    </main>
  );
}
