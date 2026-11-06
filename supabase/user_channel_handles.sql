-- ============================================================================
-- Tabela de handles de canal por usuário — Trama
-- Execute este SQL no SQL Editor do Supabase (Dashboard do projeto).
-- Cada usuário pode definir seu próprio @ para cada canal de rede social.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_channel_handles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  channel_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE public.user_channel_handles ENABLE ROW LEVEL SECURITY;

-- Cada usuário le apenas seus próprios handles
CREATE POLICY "Usuarios leem seus proprios handles"
ON public.user_channel_handles FOR SELECT
USING (auth.uid() = user_id);

-- Cada usuário insere seus próprios handles
CREATE POLICY "Usuarios inserem seus proprios handles"
ON public.user_channel_handles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Cada usuário atualiza seus próprios handles
CREATE POLICY "Usuarios atualizam seus proprios handles"
ON public.user_channel_handles FOR UPDATE
USING (auth.uid() = user_id);

-- Cada usuário exclui seus próprios handles
CREATE POLICY "Usuarios excluem seus proprios handles"
ON public.user_channel_handles FOR DELETE
USING (auth.uid() = user_id);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_user_channel_handles_user_id
  ON public.user_channel_handles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_channel_handles_user_channel
  ON public.user_channel_handles(user_id, channel_id);

-- ============================================================================
-- FIM
-- ============================================================================
