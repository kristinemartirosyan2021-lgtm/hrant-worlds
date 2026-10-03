"use client";

import { useCallback, useEffect, useState } from "react";
import { login, logout } from "@/app/actions";
import Admin from "@/components/Admin";
import Chat from "@/components/Chat";
import Credits from "@/components/Credits";
import Gallery from "@/components/Gallery";
import Studio, { type StudioMode } from "@/components/Studio";
import { fetchMe, type Me } from "@/lib/account";

type Mode = "chat" | StudioMode | "gallery" | "credits" | "admin";

const NAV: { id: Mode; icon: string; label: string; admin?: boolean }[] = [
  { id: "chat", icon: "💬", label: "Զրույց" },
  { id: "image", icon: "🎨", label: "Նկար" },
  { id: "edit", icon: "🪄", label: "Խմբագրել" },
  { id: "video", icon: "🎬", label: "Վիդեո" },
  { id: "tools", icon: "🧰", label: "Գործիքներ" },
  { id: "gallery", icon: "🖼️", label: "Պատկերասրահ" },
  { id: "credits", icon: "💎", label: "Կրեդիտներ" },
  { id: "admin", icon: "🛠️", label: "Ադմին", admin: true },
];

function Landing({ me }: { me: Me | null }) {
  return (
    <div className="landing">
      <div className="landing-card">
        <div className="brand big">
          <span className="brand-mark">H</span>
          <span className="brand-name">HrantSi</span>
        </div>
        <h1>Զրուցիր, ստեղծիր նկարներ և վիդեոներ</h1>
        <ul className="landing-list">
          <li>💬 AI զրույց հայերեն</li>
          <li>🎨 Ռեալիստիկ նկարներ նկարագրությունից</li>
          <li>🪄 Լուսանկարի խմբագրում՝ «տեղափոխիր ինձ Փարիզ»</li>
          <li>🎬 Վիդեոներ տեքստից կամ նկարից</li>
        </ul>
        {me && me.freeCredits > 0 && <p className="gift">🎁 Գրանցվելիս՝ {me.freeCredits} անվճար կրեդիտ</p>}
        {me?.setupError ? (
          <p className="error-box">⚙️ {me.setupError}</p>
        ) : (
          <form action={login}>
            <button className="primary google" type="submit">
              <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Մուտք Google-ով
            </button>
          </form>
        )}
        <p className="muted small">© 2026 Kristine Martirosyan</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");

  const refresh = useCallback(async () => {
    setMe(await fetchMe());
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener("hrantsi-credits", onChange);
    return () => window.removeEventListener("hrantsi-credits", onChange);
  }, [refresh]);

  if (!loaded) return <div className="landing muted">Բեռնվում է…</div>;
  if (!me?.signedIn) return <Landing me={me} />;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">H</span>
          <span className="brand-name">HrantSi</span>
        </div>
        <button className="credit-pill" onClick={() => setMode("credits")} title="Կրեդիտներ">
          💎 {me.credits ?? 0}
        </button>
        <nav>
          {NAV.filter((n) => !n.admin || me.isAdmin).map((n) => (
            <button key={n.id} className={`nav-item ${mode === n.id ? "active" : ""}`} onClick={() => setMode(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="muted user-email">{me.email}</span>
          <form action={logout}>
            <button className="link-btn" type="submit">Ելք</button>
          </form>
        </div>
      </aside>

      <main className="main">
        {/* Բաժինները մնում են բաց, որ անցումների ժամանակ աշխատանքը չկորի */}
        <div className="mobile-top">
          <span className="brand-name">HrantSi</span>
          <button className="credit-pill" onClick={() => setMode("credits")}>💎 {me.credits ?? 0}</button>
        </div>
        <div className="pane" hidden={mode !== "chat"}>
          <Chat />
        </div>
        {(["image", "edit", "video", "tools"] as const).map((m) => (
          <div key={m} className="pane" hidden={mode !== m}>
            <Studio mode={m} costs={me.costs} credits={me.credits ?? 0} onNeedCredits={() => setMode("credits")} />
          </div>
        ))}
        <div className="pane" hidden={mode !== "gallery"}>
          <Gallery />
        </div>
        <div className="pane" hidden={mode !== "credits"}>
          <Credits me={me} />
        </div>
        {me.isAdmin && (
          <div className="pane" hidden={mode !== "admin"}>
            <Admin />
          </div>
        )}
      </main>
    </div>
  );
}
