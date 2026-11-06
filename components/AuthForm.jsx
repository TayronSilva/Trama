'use client';

import { useState } from 'react';
import { BrandMark, Icon } from './Icons';
import { signInAction, signUpAction } from '../app/auth/actions';

export default function AuthForm() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      if (mode === 'signin') {
        const res = await signInAction(formData);
        if (res?.error) setError(res.error);
      } else {
        const res = await signUpAction(formData);
        if (res?.error) {
          setError(res.error);
        } else if (res?.message) {
          setMessage(res.message);
          setMode('signin');
        }
      }
    } catch (err) {
      // redirect() do Next.js lança NEXT_REDIRECT intencionalmente
      if (err?.message?.includes('NEXT_REDIRECT') || err?.digest?.includes('NEXT_REDIRECT')) {
        return;
      }
      setError('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="auth-brand">
          {/* BrandMark com cores adaptadas para fundo claro */}
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="17" height="6" rx="3" fill="#e11d48" />
            <rect x="12" y="13" width="17" height="6" rx="3" fill="#16211c" />
            <rect x="3" y="21" width="17" height="6" rx="3" fill="#8fa697" />
          </svg>
          <span className="brand-name" style={{ color: 'var(--ink)' }}>trama</span>
        </div>
        <p className="auth-tagline">
          {mode === 'signin'
            ? 'Acesse seu espaço de conteúdo'
            : 'Crie sua conta e convide sua equipe'}
        </p>
      </div>

      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={`auth-tab ${mode === 'signin' ? 'is-active' : ''}`}
          onClick={() => switchMode('signin')}
        >
          Entrar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={`auth-tab ${mode === 'signup' ? 'is-active' : ''}`}
          onClick={() => switchMode('signup')}
        >
          Criar conta
        </button>
      </div>

      {error && (
        <div className="auth-alert is-error" role="alert">
          <Icon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="auth-alert is-success" role="status">
          <Icon name="check" size={15} />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        {mode === 'signup' && (
          <div className="field-group">
            <label htmlFor="auth-name" className="field-label">
              Nome ou apelido
            </label>
            <input
              id="auth-name"
              name="name"
              type="text"
              required
              placeholder="Ex: Tayronne"
              className="auth-input"
              autoComplete="name"
              autoFocus
            />
          </div>
        )}

        <div className="field-group">
          <label htmlFor="auth-email" className="field-label">
            E-mail
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            required
            placeholder="seu@email.com"
            className="auth-input"
            autoComplete="email"
            autoFocus={mode === 'signin'}
          />
        </div>

        <div className="field-group">
          <label htmlFor="auth-password" className="field-label">
            Senha
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            required
            minLength={6}
            placeholder={mode === 'signin' ? '••••••••' : 'Mínimo de 6 caracteres'}
            className="auth-input"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="auth-submit"
        >
          {loading ? (
            <span>Aguarde...</span>
          ) : mode === 'signin' ? (
            <>
              <span>Entrar</span>
              <Icon name="arrow-right" size={15} />
            </>
          ) : (
            <>
              <span>Criar conta</span>
              <Icon name="arrow-right" size={15} />
            </>
          )}
        </button>
      </form>

      <div className="auth-footer">
        <span className="env-dot" aria-hidden="true" />
        <span>Autenticação segura via Supabase Auth & RLS</span>
      </div>
    </div>
  );
}
