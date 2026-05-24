"use client";
import { useEffect, useState } from "react";

type User = { name?: string; email: string; role: string; created_at?: string };

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [toggles, setToggles] = useState({ twofa: false, login: true, upload: true });

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    })();
  }, []);

  const flip = (key: keyof typeof toggles) => setToggles((t) => ({ ...t, [key]: !t[key] }));

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Home</p>
        <h1 className="page-title">Settings</h1>
        <p className="muted">Manage your account preferences and security settings.</p>
      </div>

      <div className="card">
        <h3>Profile Information</h3>
        <p className="muted">Your account details</p>
        {user ? (
          <div className="list-card" style={{ marginTop: 12 }}>
            <div className="list-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div><strong>Name</strong><div>{user.name || "Unknown"}</div></div>
              <div><strong>Email</strong><div>{user.email}</div></div>
            </div>
            <div className="list-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div><strong>Role</strong><div>{user.role}</div></div>
              <div><strong>Member Since</strong><div>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</div></div>
            </div>
          </div>
        ) : (
          <div className="muted">Loading profile...</div>
        )}
      </div>

      <div className="card">
        <h3>Security</h3>
        <p className="muted">Manage your security preferences</p>
        <div className="toggle-row">
          <div className="toggle-label">
            <strong>Two-Factor Authentication</strong>
            <span className="muted">Add an extra layer of security to your account</span>
          </div>
          <button className={`toggle${toggles.twofa ? " active" : ""}`} onClick={() => flip("twofa")} aria-label="toggle two factor" />
        </div>
        <div className="toggle-row">
          <div className="toggle-label">
            <strong>Login Notifications</strong>
            <span className="muted">Get notified when someone logs into your account</span>
          </div>
          <button className={`toggle${toggles.login ? " active" : ""}`} onClick={() => flip("login")} aria-label="toggle login alerts" />
        </div>
      </div>

      <div className="card">
        <h3>Notifications</h3>
        <p className="muted">Configure how you receive notifications</p>
        <div className="toggle-row">
          <div className="toggle-label">
            <strong>File Upload Notifications</strong>
            <span className="muted">Get notified when file uploads complete</span>
          </div>
          <button className={`toggle${toggles.upload ? " active" : ""}`} onClick={() => flip("upload")} aria-label="toggle upload alerts" />
        </div>
      </div>
    </div>
  );
}
