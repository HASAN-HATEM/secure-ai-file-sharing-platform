"use client";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const load = async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  };
  useEffect(() => { load(); }, []);

  const changeRole = async (userId: number, role: string) => {
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role }) });
    const data = await res.json();
    if (res.ok) { setMessage("Role updated"); load(); }
    else setMessage(data.error || "Failed");
  };

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Admin</p>
        <h1 className="page-title">User management</h1>
      </div>
      <div className="card">
        <h2>Admin Panel</h2>
        <p>Manage users and roles.</p>
        <p>{message}</p>
        <table>
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name}</td>
                <td><span className="status-tag">{u.role}</span></td>
                <td>
                  <button className="button" onClick={() => changeRole(u.id, u.role === 'ADMIN' ? 'USER' : 'ADMIN')}>
                    Make {u.role === 'ADMIN' ? 'User' : 'Admin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
