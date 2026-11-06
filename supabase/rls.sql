-- ============================================================================
-- Row Level Security (RLS) — Trama / Supabase
-- Execute este SQL no SQL Editor do Supabase (Dashboard do projeto).
-- ============================================================================

-- Habilitar RLS em todas as tabelas relevantes
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- profiles: cada usuario le/escreve apenas seu proprio perfil
-- ----------------------------------------------------------------------------
CREATE POLICY "Usuarios leem seu proprio perfil"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Usuarios atualizam seu proprio perfil"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Insercao permitida apenas para o proprio usuario (signup)
CREATE POLICY "Usuarios inserem seu proprio perfil"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- workspaces: proprietario e membros leem; apenas owner cria/edita/exclui
-- ----------------------------------------------------------------------------
CREATE POLICY "Membros leem workspaces aos quais pertencem"
ON public.workspaces FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspaces.id
      AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Qualquer usuario autenticado cria workspace"
ON public.workspaces FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner edita seu workspace"
ON public.workspaces FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspaces.id
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
  )
);

CREATE POLICY "Owner exclui seu workspace"
ON public.workspaces FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspaces.id
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
  )
);

-- ----------------------------------------------------------------------------
-- workspace_members: membros leem; owner/admin gerenciam
-- ----------------------------------------------------------------------------
CREATE POLICY "Membros leem membros do workspace"
ON public.workspace_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Owner/Admin criam membros"
ON public.workspace_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Owner/Admin atualizam membros"
ON public.workspace_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Owner/Admin excluem membros"
ON public.workspace_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  )
);

-- ----------------------------------------------------------------------------
-- workspace_invites: membros leem convites do workspace; owner/admin criam
-- ----------------------------------------------------------------------------
CREATE POLICY "Membros leem convites do workspace"
ON public.workspace_invites FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_invites.workspace_id
      AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Owner/Admin criam convites"
ON public.workspace_invites FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_invites.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  )
);

-- ----------------------------------------------------------------------------
-- notifications: cada usuario le/marca suas proprias notificacoes
-- ----------------------------------------------------------------------------
CREATE POLICY "Usuarios leem suas notificacoes"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios atualizam suas notificacoes"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Servico pode inserir notificacoes (via Server Action de convite)
CREATE POLICY "Sistema insere notificacoes"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- ============================================================================
-- Indices recomendados para performance das policies RLS
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_user
  ON public.workspace_members(workspace_id, user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace
  ON public.workspace_invites(workspace_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id);

-- ============================================================================
-- FIM
-- ============================================================================
