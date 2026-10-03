"use client";

import { useState } from "react";
import { amd, type Me } from "@/lib/account";

const TASK_LABELS: Record<string, string> = {
  image: "🎨 Նկար",
  edit: "🪄 Խմբագրում",
  video: "🎬 Վիդեո",
  upscale: "🔍 Որակի բարձրացում",
  "remove-bg": "✂️ Ֆոնի հեռացում",
};

export default function Credits({ me }: { me: Me }) {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(me.email ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* պատճենումը կարող է արգելված լինել */
    }
  }

  return (
    <div className="studio">
      <header className="studio-head">
        <h1>Կրեդիտներ</h1>
        <p className="muted">Կրեդիտներով ստեղծում ես նկարներ և վիդեոներ։ Զրույցը անվճար է՝ օրական {me.chatDailyLimit} հաղորդագրություն։</p>
      </header>

      <div className="credits-grid">
        <section className="panel balance">
          <span className="muted">Քո հաշվեկշիռը</span>
          <strong>{me.credits ?? 0}</strong>
          <span className="muted">կրեդիտ</span>
        </section>

        <section className="panel">
          <h2 className="panel-title">Որքան արժե</h2>
          <ul className="price-list">
            {Object.entries(me.costs).map(([task, cost]) => (
              <li key={task}>
                <span>{TASK_LABELS[task] ?? task}</span>
                <span>{cost} կրեդիտ</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <h2 className="section-title">Գնել կրեդիտ</h2>
      <div className="packs">
        {me.packs.map((p) => (
          <div key={p.credits} className="panel pack">
            <strong>{p.credits}</strong>
            <span className="muted">կրեդիտ</span>
            <span className="pack-price">{amd(p.price)}</span>
            <span className="muted small">≈ {Math.floor(p.credits / Math.max(1, me.costs.image))} նկար</span>
          </div>
        ))}
      </div>

      <section className="panel how">
        <h2 className="panel-title">Ինչպես վճարել</h2>
        <ol>
          <li>Ընտրիր փաթեթը և փոխանցիր գումարը՝
            <div className="pay-info">{me.payInfo || "Վճարման տվյալները շուտով կավելացվեն։"}</div>
          </li>
          <li>
            Վճարման նշումում գրիր քո email-ը՝{" "}
            <button className="email-chip" onClick={() => void copyEmail()} title="Պատճենել">
              {me.email} {copied ? "✓" : "📋"}
            </button>
          </li>
          <li>Կրեդիտները կավելացվեն քո հաշվին վճարումը ստուգելուց հետո։</li>
        </ol>
        {me.contact && <p className="muted">Հարցերի համար՝ {me.contact}</p>}
      </section>
    </div>
  );
}
