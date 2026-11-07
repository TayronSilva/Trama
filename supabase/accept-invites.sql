-- ============================================================================
-- Migração: aceite e recusa de convites de workspace
-- Execute este SQL no SQL Editor do Supabase (Dashboard do projeto).
-- ============================================================================

-- Coluna para marcar quando o convite foi encerrado (aceito ou recusado)
ALTER TABLE public.workspace_invites
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Coluna para vincular o usuário quando ele já existe no sistema
ALTER TABLE public.workspace_invites
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Status explícito do convite. "rejected" é usado para recusas.
ALTER TABLE public.workspace_invites
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_invites_status_check'
      AND conrelid = 'public.workspace_invites'::regclass
  ) THEN
    ALTER TABLE public.workspace_invites
    ADD CONSTRAINT workspace_invites_status_check
    CHECK (status IN ('pending', 'accepted', 'rejected'));
  END IF;
END $$;

-- Índice para busca rápida de convites pendentes por email
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email_pending
  ON public.workspace_invites(email, accepted_at)
  WHERE accepted_at IS NULL;

-- Política RLS: usuários podem ler seus próprios convites (por email)
DROP POLICY IF EXISTS "Usuarios leem seus proprios convites pendentes"
ON public.workspace_invites;

CREATE POLICY "Usuarios leem seus proprios convites pendentes"
ON public.workspace_invites FOR SELECT
USING (
  auth.uid() = invited_by
  OR lower(email) = lower(auth.email())
);

-- Política RLS: usuários podem aceitar ou recusar seus próprios convites
DROP POLICY IF EXISTS "Usuarios aceitam seus proprio convites"
ON public.workspace_invites;

CREATE POLICY "Usuarios aceitam seus proprio convites"
ON public.workspace_invites FOR UPDATE
USING (lower(email) = lower(auth.email()))
WITH CHECK (lower(email) = lower(auth.email()));

-- Política RLS: o usuário convidado pode entrar no workspace somente
-- enquanto o convite estiver pendente.
DROP POLICY IF EXISTS "Usuario aceita convite e entra no workspace"
ON public.workspace_members;

CREATE POLICY "Usuario aceita convite e entra no workspace"
ON public.workspace_members FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.workspace_invites wi
    WHERE wi.workspace_id = workspace_members.workspace_id
      AND lower(wi.email) = lower(auth.email())
      AND wi.accepted_at IS NULL
      AND (wi.status IS NULL OR wi.status = 'pending')
  )
);

-- ============================================================================
-- FIM
-- ============================================================================
