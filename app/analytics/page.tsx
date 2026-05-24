"use client";
import { useEffect, useState } from "react";

type Distribution = { mime_type: string; count: number };

export default function AnalyticsPage() {
  const [data, setData] = useState<{
    totalUsers: number;
    totalFiles: number;
    totalBytes: number;
    threatsBlocked: number;
    cleanFiles: number;
    distribution: Distribution[];
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/analytics");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to load analytics");
        return;
      }
      const body = await res.json();
      setData(body);
    })();
  }, []);

  const storageUsedMb = data ? data.totalBytes / 1024 / 1024 : 0;

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Analytics</p>
        <h1 className="page-title">Analytics</h1>
        <p className="muted">System-wide statistics and metrics.</p>
      </div>

      {error && <div className="card tag-danger">{error}</div>}

      {data && (
        <>
          <div className="stat-grid">
            <div className="card stat-card">
              <div className="stat-card__icon">👥</div>
              <div className="stat-card__label">Total Users</div>
              <div className="stat-card__value">{data.totalUsers}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-card__icon">📄</div>
              <div className="stat-card__label">Total Files</div>
              <div className="stat-card__value">{data.totalFiles}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-card__icon">💾</div>
              <div className="stat-card__label">Storage Used</div>
              <div className="stat-card__value">{storageUsedMb.toFixed(2)} MB</div>
            </div>
            <div className="card stat-card">
              <div className="stat-card__icon">🛡</div>
              <div className="stat-card__label">Threats Blocked</div>
              <div className="stat-card__value">{data.threatsBlocked}</div>
            </div>
          </div>

          <div className="panel-grid">
            <div className="card">
              <div className="card__header">
                <div className="card__title">File Types Distribution</div>
              </div>
              {data.distribution.length === 0 && <div className="muted">No files yet</div>}
              {data.distribution.map((d) => (
                <div key={d.mime_type} style={{ marginBottom: 8 }}>
                  <div className="flex" style={{ justifyContent: "space-between" }}>
                    <span>{d.mime_type || "Other"}</span>
                    <span className="muted">{d.count} files</span>
                  </div>
                  <div className="progress">
                    <div className="progress__fill" style={{ width: `${Math.min(100, d.count * 20)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card__header">
                <div className="card__title">Security Overview</div>
              </div>
              <div className="log-list">
                <div className="log-item" style={{ background: "#e7f7ec" }}>
                  <div className="card__title">Clean Files</div>
                  <div className="muted">Files that passed security scan</div>
                  <div className="stat-card__value" style={{ color: "#1f7a3f" }}>{data.cleanFiles}</div>
                </div>
                <div className="log-item" style={{ background: "#fdeced" }}>
                  <div className="card__title">Blocked Files</div>
                  <div className="muted">Malicious files blocked</div>
                  <div className="stat-card__value" style={{ color: "#c53030" }}>{data.threatsBlocked}</div>
                </div>
                <div className="log-item" style={{ background: "#fff5e2" }}>
                  <div className="card__title">Security Alerts</div>
                  <div className="muted">Suspicious activities detected</div>
                  <div className="stat-card__value" style={{ color: "#c05621" }}>{Math.max(0, data.threatsBlocked - 0)}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
