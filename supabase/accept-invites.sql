-- ============================================================================
-- Migração: adicionar campo de aceitação a workspace_invites
-- Execute este SQL no SQL Editor do Supabase (Dashboard do projeto).
-- ============================================================================

-- Coluna para marcar quando o convite foi aceito
ALTER TABLE public.workspace_invites
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Índice para busca rápida de convites pendentes por email
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email_pending
  ON public.workspace_invites(email, accepted_at)
  WHERE accepted_at IS NULL;

-- Política RLS: usuários podem ler seus próprios convites pendentes
CREATE POLICY "Usuarios leem seus proprios convites pendentes"
ON public.workspace_invites FOR SELECT
USING (auth.uid() = invited_by OR email = auth.users.email);

-- Política RLS: usuarios podem atualizar (aceitar) seus proprio convites
CREATE POLICY "Usuarios aceitam seus proprio convites"
ON public.workspace_invites FOR UPDATE
USING (email = auth.users.email)
WITH CHECK (email = auth.users.email);

-- ============================================================================
-- FIM
-- ============================================================================
