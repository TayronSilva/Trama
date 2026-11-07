-- ============================================================================
-- Migração: adicionar campo de aceitação a workspace_invites
-- Execute este SQL no SQL Editor do Supabase (Dashboard do projeto).
-- ============================================================================

-- Coluna para marcar quando o convite foi aceito
ALTER TABLE public.workspace_invites
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Coluna opcional para vincular o usuário quando já existe no sistema
ALTER TABLE public.workspace_invites
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Índice para busca rápida de convites pendentes por email
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email_pending
  ON public.workspace_invites(email, accepted_at)
  WHERE accepted_at IS NULL;

-- Política RLS: usuários podem ler seus próprios convites pendentes (por email)
CREATE POLICY "Usuarios leem seus proprios convites pendentes"
ON public.workspace_invites FOR SELECT
USING (auth.uid() = invited_by OR lower(email) = lower(auth.email()));

-- Política RLS: usuarios podem atualizar (aceitar) seus proprio convites
CREATE POLICY "Usuarios aceitam seus proprio convites"
ON public.workspace_invites FOR UPDATE
USING (lower(email) = lower(auth.email()))
WITH CHECK (lower(email) = lower(auth.email()));

-- Política RLS: usuario pode se inserir como membro se houver convite pendente para seu email
CREATE POLICY "Usuario aceita convite e entra no workspace"
ON public.workspace_members FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.workspace_invites wi
    WHERE wi.workspace_id = workspace_members.workspace_id
      AND lower(wi.email) = lower(auth.email())
      AND wi.accepted_at IS NULL
  )
);

-- ============================================================================
-- FIM
-- ============================================================================
