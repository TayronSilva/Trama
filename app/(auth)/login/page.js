import AuthForm from '../../../components/AuthForm';

export const metadata = {
  title: 'Entrar · Trama',
  description: 'Acesse seu estúdio de conteúdo e colabore com sua equipe.',
};

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <AuthForm />
      </div>
    </div>
  );
}

