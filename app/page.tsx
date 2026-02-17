import Link from 'next/link';
import { MINSTR_MINT } from '@/lib/constants';

const SOCIAL_LINKS = [
  { href: 'https://x.com/sessionmintlabs', label: 'SessionMint X' },
  { href: 'https://t.me/SessionMint', label: 'Telegram' },
  { href: 'https://github.com/sessionmint', label: 'GitHub' },
  {
    href: `https://pump.fun/coin/${MINSTR_MINT}`,
    label: 'Pump.fun',
  },
] as const;

export default function HomePage() {
  const panelStyle = {
    border: '1px solid rgba(255,255,255,0.11)',
    borderRadius: 18,
    background:
      'linear-gradient(165deg, rgba(18,18,25,0.93), rgba(14,16,23,0.88))',
    boxShadow:
      '0 12px 34px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.03)',
    backdropFilter: 'blur(10px)',
  } as const;

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 9% 12%, rgba(57,255,20,0.10), transparent 34%), radial-gradient(circle at 92% 5%, rgba(0,191,255,0.09), transparent 30%), radial-gradient(circle at 55% 100%, rgba(124,58,237,0.09), transparent 44%), #07080c',
        padding: '28px 16px 56px',
      }}
    >
      <div style={{ width: 'min(920px, 100%)', margin: '0 auto' }}>
        <header
          style={{
            ...panelStyle,
            padding: '34px 24px',
            marginBottom: 18,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.2rem)',
              lineHeight: 1.06,
              margin: '0 0 12px',
              background: 'linear-gradient(100deg, #f3f4f6 30%, #8ab4ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            SessionMint.fun
          </h1>
          <p style={{ color: '#a1a1aa', margin: '0 auto 18px', maxWidth: 760 }}>
            A deterministic control layer for live stream focus and time-bounded Session State allocation.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 9,
              marginBottom: 16,
            }}
          >
            {SOCIAL_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 108,
                  padding: '0.64rem 0.9rem',
                  borderRadius: 11,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  color: '#d9e8ff',
                  textDecoration: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                }}
              >
                {item.label}
              </a>
            ))}
          </div>

          <Link
            href="/chartgobrralpha"
            style={{
              display: 'inline-block',
              padding: '0.8rem 1.18rem',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #39ff14 0%, #4fff29 100%)',
              color: '#000',
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 10px 26px rgba(57,255,20,0.24)',
            }}
          >
            Open ChartGoBrrAlpha
          </Link>
        </header>

        <section
          style={{
            ...panelStyle,
            padding: '20px',
            marginBottom: 14,
            textAlign: 'center',
          }}
        >
          <h2 style={{ margin: '0 0 8px', color: '#f3f4f6', fontSize: '1.1rem' }}>
            $MINSTR Contract Address
          </h2>
          <code
            style={{
              color: '#e9eef5',
              fontSize: '0.95rem',
              lineHeight: 1.45,
              wordBreak: 'break-all',
              userSelect: 'all',
            }}
          >
            {MINSTR_MINT}
          </code>
        </section>
      </div>
    </main>
  );
}
