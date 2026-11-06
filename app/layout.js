import { Bricolage_Grotesque, Schibsted_Grotesk } from 'next/font/google';
import Sidebar from '../components/Sidebar';
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

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        <div className="app-shell">
          <Sidebar />
          <main id="conteudo" className="main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
