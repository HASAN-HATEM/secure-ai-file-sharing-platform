'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type PackageDefinition = {
  key: string;
  name: string;
  priceCents: number;
  storageLimitBytes: number;
  features: string[];
  requiresUtmVerification?: boolean;
  badge?: string;
};

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function formatPrice(priceCents: number) {
  return priceCents === 0 ? 'Free' : `$${(priceCents / 100).toFixed(0)}/mo`;
}

export default function ChoosePlanPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<PackageDefinition[]>([]);
  const [selecting, setSelecting] = useState('');
  const [showUtmForm, setShowUtmForm] = useState(false);
  const [utmInput, setUtmInput] = useState('');
  const [utmLoading, setUtmLoading] = useState(false);
  const [utmMsg, setUtmMsg] = useState('');
  const [utmErr, setUtmErr] = useState(false);

  useEffect(() => {
    fetch('/api/account/plan', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => null);
  }, []);

  const handleSelect = async (packageKey: string) => {
    if (packageKey === 'edu') {
      setShowUtmForm(true);
      return;
    }
    setSelecting(packageKey);
    await fetch('/api/account/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageKey }),
    }).catch(() => null);
    router.push('/dashboard');
  };

  const handleUtmVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUtmMsg('');
    setUtmLoading(true);
    const res = await fetch('/api/account/utm-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utmEmail: utmInput.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setUtmMsg(`Verification email sent to ${utmInput.trim()}. Check your UTM inbox and click the link — you'll be upgraded automatically. For now, continue to the dashboard.`);
      setUtmErr(false);
    } else {
      setUtmMsg(data.error || 'Failed to send verification email.');
      setUtmErr(true);
    }
    setUtmLoading(false);
  };

  const ACCENT_MAP: Record<string, string> = {
    free: '#66758f',
    edu:  '#16a34a',
    plus: '#0f4da8',
    pro:  '#7c3aed',
  };

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Getting started</p>
        <h1 className="page-title">Choose your plan</h1>
        <p className="muted">Pick what fits your needs. You can switch plans anytime in Settings.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {packages.map((p) => {
          const accentColor = ACCENT_MAP[p.key] || 'var(--accent)';
          const isEdu = p.key === 'edu';

          return (
            <div
              key={p.key}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
            >
              {/* Card header stripe */}
              <div style={{ background: accentColor, padding: '18px 20px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <strong style={{ color: '#fff', fontSize: 17, fontWeight: 800 }}>{p.name}</strong>
                  {p.badge && (
                    <span style={{
                      background: 'rgba(255,255,255,0.2)', color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      letterSpacing: 0.4, textTransform: 'uppercase'
                    }}>
                      {p.badge}
                    </span>
                  )}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 22, fontWeight: 800, marginBottom: 2 }}>
                  {formatPrice(p.priceCents)}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
                  {formatBytes(p.storageLimitBytes)} storage
                </div>
              </div>

              {/* Features */}
              <div style={{ padding: '16px 20px', flex: 1 }}>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ fontSize: 13, color: 'var(--ink)', padding: '4px 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: accentColor, fontWeight: 800, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div style={{ padding: '0 20px 20px' }}>
                {isEdu && !showUtmForm && (
                  <button
                    type="button"
                    className="button"
                    style={{ width: '100%', background: accentColor, borderColor: accentColor }}
                    onClick={() => setShowUtmForm(true)}
                  >
                    Unlock with UTM email
                  </button>
                )}

                {isEdu && showUtmForm && !utmMsg && (
                  <form onSubmit={handleUtmVerify}>
                    <input
                      className="input"
                      type="email"
                      placeholder="you@graduate.utm.my"
                      value={utmInput}
                      onChange={(e) => setUtmInput(e.target.value)}
                      style={{ marginBottom: 8, fontSize: 13 }}
                      required
                    />
                    <button
                      type="submit"
                      className="button"
                      style={{ width: '100%', background: accentColor, borderColor: accentColor }}
                      disabled={utmLoading}
                    >
                      {utmLoading ? 'Sending…' : 'Send verification email'}
                    </button>
                    {utmErr && utmMsg && (
                      <div className="muted" style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{utmMsg}</div>
                    )}
                  </form>
                )}

                {isEdu && utmMsg && !utmErr && (
                  <div style={{ fontSize: 13, color: '#16a34a', lineHeight: 1.5 }}>{utmMsg}</div>
                )}

                {!isEdu && (
                  <button
                    type="button"
                    className="button"
                    style={{ width: '100%', background: accentColor, borderColor: accentColor }}
                    disabled={selecting === p.key}
                    onClick={() => handleSelect(p.key)}
                  >
                    {selecting === p.key ? 'Setting up…' : `Choose ${p.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center' }}>
        {utmMsg && !utmErr ? (
          <Link href="/dashboard" className="button ghost" style={{ display: 'inline-block' }}>
            Continue to dashboard →
          </Link>
        ) : (
          <Link href="/dashboard" style={{ color: 'var(--muted)', fontSize: 14 }}>
            Skip — continue with Free plan →
          </Link>
        )}
      </div>
    </div>
  );
}
