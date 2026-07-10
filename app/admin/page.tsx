"use client";
import { useEffect, useRef, useState } from "react";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; email: string } | null>(null);

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

  const toggleBlocked = async (userId: number, disabled: boolean) => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, disabled })
    });
    const data = await res.json();
    if (res.ok) { setMessage(disabled ? "User blocked" : "User unblocked"); setIsError(false); load(); }
    else { setMessage(data.error || "Failed"); setIsError(true); }
  };

  const openDeleteDialog = (id: number, email: string) => {
    setDeleteTarget({ id, email });
    deleteDialogRef.current?.showModal();
  };

  const closeDeleteDialog = () => {
    deleteDialogRef.current?.close();
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    closeDeleteDialog();
    const res = await fetch(`/api/admin/users?userId=${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setMessage("User deleted"); setIsError(false); load(); }
    else { setMessage(data.error || "Failed to delete"); setIsError(true); }
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
            <div className="card__subtitle">Manage users, roles and access.</div>
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
              <div className="muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
                {u.email}
                {u.disabled && <span className="chip chip--danger" style={{ marginLeft: 8 }}>Blocked</span>}
              </div>
              <div style={{ fontWeight: 700 }}>{u.name || "—"}</div>
              <div>
                <span className="status-tag">{u.role}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                <button
                  className="button ghost"
                  style={{ fontSize: 13, padding: "6px 12px" }}
                  onClick={() => changeRole(u.id, u.role === "ADMIN" ? "USER" : "ADMIN")}
                >
                  Make {u.role === "ADMIN" ? "User" : "Admin"}
                </button>
                <button
                  className="button ghost"
                  style={{ fontSize: 13, padding: "6px 12px" }}
                  onClick={() => toggleBlocked(u.id, !u.disabled)}
                >
                  {u.disabled ? "Unblock" : "Block"}
                </button>
                <button
                  className="button ghost"
                  style={{ fontSize: 13, padding: "6px 12px", color: "var(--danger)" }}
                  onClick={() => openDeleteDialog(u.id, u.email)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <dialog
        ref={deleteDialogRef}
        className="share-dialog"
        onClick={(e) => { if (e.target === deleteDialogRef.current) closeDeleteDialog(); }}
      >
        <div className="share-dialog__body">
          <div className="share-dialog__title">Delete this user?</div>
          <div className="share-dialog__sub">{deleteTarget?.email}</div>
          <p className="muted" style={{ fontSize: 13, margin: "12px 0 20px" }}>
            This permanently removes the account. If they still own files or shares, deletion will be blocked — block the user instead in that case.
          </p>
          <div className="button-row">
            <button className="button" type="button" onClick={confirmDelete}>Delete</button>
            <button className="button ghost" type="button" onClick={closeDeleteDialog}>Cancel</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
