import type { Metadata } from 'next';
import LoginForm from '@/components/admin/LoginForm';

export const metadata: Metadata = {
  title: 'Bejelentkezés',
  robots: { index: false, follow: false },
};

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return <LoginForm nextPath={searchParams.next || '/admin'} />;
}
