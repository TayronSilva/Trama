import { Bricolage_Grotesque, Schibsted_Grotesk } from 'next/font/google';
import { headers } from 'next/headers';
import Sidebar from '../components/Sidebar';
import { getUserChannelHandles } from '../app/auth/actions';
import { createClient } from '../lib/supabase/server';
import './globals.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const body = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'Trama — estúdio de conteúdo',
    template: '%s · Trama',
  },
  description:
    'Biblioteca de ideias e calendário editorial para planejar publicações em canais sociais.',
};

export const viewport = {
  themeColor: '#16211c',
};

// Rotas que NÃO exibem a sidebar (páginas de auth)
const AUTH_PATHS = ['/login', '/auth'];

export default async function RootLayout({ children }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  const isAuth = AUTH_PATHS.some((p) => pathname.startsWith(p));

  let userHandles = {};
  let userId = '';

  if (!isAuth) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        const res = await getUserChannelHandles();
        if (res.ok && res.handles) {
          userHandles = res.handles;
        }
      }
    } catch {
      // Falha ao carregar handles do servidor
    }
  }

  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>
        {isAuth ? (
          children
        ) : (
          <>
            <a className="skip-link" href="#conteudo">
              Pular para o conteúdo
            </a>
            <div className="app-shell">
              <Sidebar handles={userHandles} userId={userId} />
              <main id="conteudo" className="main">
                {children}
              </main>
            </div>
          </>
        )}
      </body>
    </html>
  );
}
