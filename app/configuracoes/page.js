import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import {
  getProfileAndWorkspace,
  getUserChannelHandles,
  getPendingInvites as getPendingInvitesAction,
} from '../auth/actions';
import { CHANNELS } from '../../lib/channels';
import ConfiguracoesForm from './_form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Configurações',
  description: 'Gerencie sua conta, espaço de trabalho e canais sociais.',
};

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const info = await getProfileAndWorkspace();
  const handlesRes = await getUserChannelHandles();
  const pendingInvites = await getPendingInvitesAction();

  const initial = {
    profile: info.user,
    workspace: info.workspace,
    role: info.role,
    teamMembers: info.teamMembers ?? [],
    workspaces: info.workspaces ?? [],
    userHandles: handlesRes.ok ? handlesRes.handles : {},
    pendingInvites: pendingInvites ?? [],
  };

  return <ConfiguracoesForm initial={initial} />;
}
