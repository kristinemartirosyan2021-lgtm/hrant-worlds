"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/client";

type Msg = { role: "user" | "assistant"; text: string; images?: string[] };

const CHAT_KEY = "hrantsi.chat.v1";

const SUGGESTIONS = [
  "Օգնիր գրել պրոմպտ՝ ռեալիստիկ նկար Երևանի գիշերային տեսարանով",
  "Բացատրիր պարզ բառերով, թե ինչպես է աշխատում AI-ը",
  "Գրիր կարճ բանաստեղծություն Արարատի մասին",
  "Թարգմանիր անգլերեն՝ «Բարի գալուստ HrantSi»",
];

// Պարզ ձևաչափում՝ ```կոդ``` բլոկներ և **թավ** տեքստ։
function Rich({ text }: { text: string }) {
  const parts = text.split(/```(?:\w+)?\n?/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="code">
            <code>{part}</code>
          </pre>
        ) : (
          <Fragment key={i}>
            {part.split(/(\*\*[^*]+\*\*)/).map((s, j) =>
              s.startsWith("**") && s.endsWith("**") ? <strong key={j}>{s.slice(2, -2)}</strong> : s,
            )}
          </Fragment>
        ),
      )}
    </>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_KEY);
      if (saved) setMessages(JSON.parse(saved) as Msg[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (busy) return;
    try {
      // Նկարները չենք պահում, որ հիշողությունը չլցվի։
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages.map(({ role, text }) => ({ role, text }))));
    } catch {
      /* ignore */
    }
  }, [messages, busy]);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all([...files].slice(0, 4).map((f) => fileToDataUrl(f, 1280)));
    setImages((prev) => [...prev, ...urls].slice(0, 4));
  }

  async function send(text = input) {
    if (busy || (!text.trim() && images.length === 0)) return;
    const next: Msg[] = [...messages, { role: "user", text: text.trim(), images }];
    setMessages([...next, { role: "assistant", text: "" }]);
    setInput("");
    setImages([]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", text: acc }]);
      }
    } catch {
      setMessages([...next, { role: "assistant", text: "⚠️ Կապի սխալ։ Փորձիր նորից։" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat">
      <div className="chat-scroll">
        {messages.length === 0 ? (
          <div className="hero">
            <div className="hero-logo">HrantSi</div>
            <p className="muted">Ինչո՞վ կարող եմ օգնել այսօր։</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.images?.length ? (
                <div className="msg-images">
                  {m.images.map((src, j) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={j} src={src} alt="" />
                  ))}
                </div>
              ) : null}
              <div className="bubble">
                {m.text ? <Rich text={m.text} /> : <span className="typing">●●●</span>}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {images.length > 0 && (
          <div className="attachments">
            {images.map((src, i) => (
              <button
                type="button"
                key={i}
                className="attachment"
                title="Հեռացնել"
                onClick={() => setImages(images.filter((_, j) => j !== i))}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
                <span>×</span>
              </button>
            ))}
          </div>
        )}
        <div className="composer-row">
          <button type="button" className="icon-btn" title="Կցել նկար" onClick={() => fileRef.current?.click()}>
            📎
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <textarea
            value={input}
            placeholder="Գրիր հաղորդագրություն HrantSi-ին…"
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button type="submit" className="send-btn" disabled={busy}>
            {busy ? "…" : "➤"}
          </button>
        </div>
        {messages.length > 0 && (
          <button type="button" className="link-btn" onClick={() => setMessages([])} disabled={busy}>
            + Նոր զրույց
          </button>
        )}
      </form>
    </div>
  );
}
