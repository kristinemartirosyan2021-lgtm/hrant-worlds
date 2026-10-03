"use client";

import { useState } from "react";
import Chat from "@/components/Chat";
import Gallery from "@/components/Gallery";
import Studio, { type StudioMode } from "@/components/Studio";

type Mode = "chat" | StudioMode | "gallery";

const NAV: { id: Mode; icon: string; label: string }[] = [
  { id: "chat", icon: "💬", label: "Զրույց" },
  { id: "image", icon: "🎨", label: "Նկար" },
  { id: "edit", icon: "🪄", label: "Խմբագրել" },
  { id: "video", icon: "🎬", label: "Վիդեո" },
  { id: "tools", icon: "🧰", label: "Գործիքներ" },
  { id: "gallery", icon: "🖼️", label: "Պատկերասրահ" },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">H</span>
          <span className="brand-name">HrantSi</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item ${mode === n.id ? "active" : ""}`} onClick={() => setMode(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <footer className="sidebar-foot muted">© 2026 Kristine Martirosyan</footer>
      </aside>

      <main className="main">
        {/* Բոլոր բաժինները մնում են բաց, որ անցումների ժամանակ աշխատանքը չկորի */}
        <div className="pane" hidden={mode !== "chat"}>
          <Chat />
        </div>
        {(["image", "edit", "video", "tools"] as const).map((m) => (
          <div key={m} className="pane" hidden={mode !== m}>
            <Studio mode={m} />
          </div>
        ))}
        <div className="pane" hidden={mode !== "gallery"}>
          <Gallery />
        </div>
      </main>
    </div>
  );
}
