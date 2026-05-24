"use client";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const load = async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  };
  useEffect(() => { load(); }, []);

  const changeRole = async (userId: number, role: string) => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role })
    });
    const data = await res.json();
    if (res.ok) { setMessage("Role updated"); setIsError(false); load(); }
    else { setMessage(data.error || "Failed"); setIsError(true); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Admin</p>
        <h1 className="page-title">User management</h1>
      </div>
      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Admin Panel</div>
            <div className="card__subtitle">Manage users and roles.</div>
          </div>
          <span className="status-tag">{users.length} user{users.length !== 1 ? "s" : ""}</span>
        </div>

        {message && (
          <div className={`status-tag${isError ? " tag-danger" : ""}`} style={{ marginBottom: 12 }}>
            {message}
          </div>
        )}

        <div className="list-card" style={{ marginTop: 8 }}>
          <div className="list-header list-header--admin">
            <span>Email</span>
            <span>Name</span>
            <span>Role</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>
          {users.length === 0 && <div className="empty-state">No users found</div>}
          {users.map((u) => (
            <div className="list-row list-row--admin" key={u.id}>
              <div className="muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
              <div style={{ fontWeight: 700 }}>{u.name || "—"}</div>
              <div>
                <span className={`status-tag${u.role === "ADMIN" ? "" : ""}`}>{u.role}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="button"
                  style={{ fontSize: 13, padding: "6px 12px" }}
                  onClick={() => changeRole(u.id, u.role === "ADMIN" ? "USER" : "ADMIN")}
                >
                  Make {u.role === "ADMIN" ? "User" : "Admin"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
