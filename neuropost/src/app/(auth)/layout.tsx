import AuthBackground from './_components/AuthBackground';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      <AuthBackground />
      <div className="auth-layout__content">{children}</div>
    </div>
  );
}
