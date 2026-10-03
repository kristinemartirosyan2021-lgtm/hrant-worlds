"use client";

import { useEffect, useState } from "react";
import { creditsChanged } from "@/lib/account";

type UserRow = { email: string; name: string; credits: number; created_at: string };
type Found = UserRow & { history: { delta: number; reason: string; created_at: string }[] };

const date = (s: string) => new Date(s).toLocaleString("hy-AM", { dateStyle: "short", timeStyle: "short" });

export default function Admin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("20");
  const [note, setNote] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadUsers() {
    const res = await fetch("/api/admin", { cache: "no-store" });
    const data = (await res.json()) as { users?: UserRow[] };
    setUsers(data.users ?? []);
  }

  async function lookup(target = email) {
    if (!target.trim()) return;
    const res = await fetch(`/api/admin?email=${encodeURIComponent(target.trim())}`, { cache: "no-store" });
    const data = (await res.json()) as { user?: Found; error?: string };
    setFound(data.user ?? null);
    setMessage(data.error ?? "");
  }

  async function add() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount: Number(amount), note }),
      });
      const data = (await res.json()) as { credits?: number; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Սխալ");
        return;
      }
      setMessage(`✅ Պատրաստ է․ ${email}-ի հաշվեկշիռը՝ ${data.credits} կրեդիտ։`);
      setNote("");
      creditsChanged();
      await Promise.all([lookup(), loadUsers()]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  return (
    <div className="studio">
      <header className="studio-head">
        <h1>Ադմին</h1>
        <p className="muted">Ավելացրու կրեդիտ վճարած օգտատերերին։ Բացասական թիվը հանում է կրեդիտ։</p>
      </header>

      <div className="credits-grid">
        <section className="panel">
          <h2 className="panel-title">Լիցքավորել</h2>
          <label className="field-label">
            Email
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => void lookup()} placeholder="anun@gmail.com" />
          </label>
          <label className="field-label">
            Կրեդիտ
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="field-label">
            Նշում (ըստ ցանկության)
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Idram, 4000֏" />
          </label>
          <button className="primary" disabled={busy || !email || !Number(amount)} onClick={() => void add()}>
            {Number(amount) < 0 ? "Հանել կրեդիտ" : "Ավելացնել կրեդիտ"}
          </button>
          {message && <p className="status-static">{message}</p>}
        </section>

        <section className="panel">
          <h2 className="panel-title">{found ? found.email : "Օգտատեր"}</h2>
          {found ? (
            <>
              <p className="muted">
                {found.name || "—"} · <strong>{found.credits}</strong> կրեդիտ
              </p>
              <ul className="price-list">
                {found.history.map((h, i) => (
                  <li key={i}>
                    <span>
                      {h.reason}
                      <br />
                      <small className="muted">{date(h.created_at)}</small>
                    </span>
                    <span className={h.delta > 0 ? "plus" : "minus"}>{h.delta > 0 ? `+${h.delta}` : h.delta}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">Գրիր email կամ ընտրիր ներքևի ցանկից։</p>
          )}
        </section>
      </div>

      <h2 className="section-title">Վերջին գրանցվածները</h2>
      <div className="panel">
        <ul className="price-list">
          {users.map((u) => (
            <li key={u.email}>
              <button
                className="link-btn left"
                onClick={() => {
                  setEmail(u.email);
                  void lookup(u.email);
                }}
              >
                {u.email}
                <br />
                <small className="muted">{date(u.created_at)}</small>
              </button>
              <span>{u.credits}</span>
            </li>
          ))}
          {users.length === 0 && <li className="muted">Դեռ ոչ ոք չկա։</li>}
        </ul>
      </div>
    </div>
  );
}
