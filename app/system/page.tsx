"use client";
import { useState } from "react";

export default function SystemSettingsPage() {
  const [maintenance, setMaintenance] = useState(false);
  const [logging, setLogging] = useState(true);

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Admin</p>
        <h1 className="page-title">System Settings</h1>
        <p className="muted">Configure platform-wide preferences.</p>
      </div>

      <div className="card">
        <h3>General</h3>
        <div className="toggle-row">
          <div className="toggle-label">
            <strong>Maintenance Mode</strong>
            <span className="muted">Temporarily disable user access.</span>
          </div>
          <button className={`toggle${maintenance ? " active" : ""}`} onClick={() => setMaintenance(!maintenance)} aria-label="toggle maintenance" />
        </div>
        <div className="toggle-row">
          <div className="toggle-label">
            <strong>Verbose Logging</strong>
            <span className="muted">Capture detailed security events.</span>
          </div>
          <button className={`toggle${logging ? " active" : ""}`} onClick={() => setLogging(!logging)} aria-label="toggle logging" />
        </div>
      </div>
    </div>
  );
}
