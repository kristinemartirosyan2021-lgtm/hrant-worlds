"use client";

import { useState } from "react";
import { enhancePrompt, fileToDataUrl, runGeneration, saveToGallery, type GalleryItem } from "@/lib/client";
import type { Task } from "@/lib/replicate";

export type StudioMode = "image" | "edit" | "video" | "tools";

const COPY: Record<StudioMode, { title: string; subtitle: string; placeholder: string; examples: string[] }> = {
  image: {
    title: "Նկարի գեներացիա",
    subtitle: "Նկարագրիր, և HrantSi-ն կստեղծի ռեալիստիկ նկար։",
    placeholder: "Օր․՝ ծեր հայ վարպետը իր արհեստանոցում, երեկոյան լույս, ֆոտո",
    examples: [
      "Արարատ լեռը արևածագին, Խոր Վիրապի տեսարանով, ռեալիստիկ ֆոտո",
      "Երիտասարդ աղջիկ Երևանի Կասկադում, ոսկե ժամ, պորտրետ",
      "Գառնիի տաճարը ձմռանը, ձյուն, մառախուղ",
      "Հայկական ավանդական սեղան՝ դոլմա, լավաշ, նուռ, վերևից տեսք",
    ],
  },
  edit: {
    title: "Նկարի խմբագրում",
    subtitle: "Վերբեռնիր նկար և գրիր, թե ինչ փոխել՝ տեղ, ֆոն, հագուստ, ոճ…",
    placeholder: "Օր․՝ տեղափոխիր ինձ Փարիզ, Էյֆելյան աշտարակի մոտ",
    examples: [
      "Տեղափոխիր ինձ Փարիզ, Էյֆելյան աշտարակի մոտ",
      "Ֆոնը փոխիր ծովափով, մայրամուտ",
      "Հագցրու ինձ դասական սև կոստյում",
      "Դարձրու ձմեռ՝ ձյունով",
    ],
  },
  video: {
    title: "Վիդեոյի գեներացիա",
    subtitle: "Նկարագրիր տեսարանը։ Կարող ես նաև նկար վերբեռնել՝ այն «կենդանացնելու» համար։",
    placeholder: "Օր․՝ դրոնը դանդաղ թռչում է Տաթևի վանքի վրայով, ամպեր",
    examples: [
      "Դրոնը դանդաղ թռչում է Տաթևի վանքի վրայով, ամպերի միջով",
      "Ծիրանենու ճյուղը օրորվում է քամուց, մոտիկ կադր",
      "Մարդը ժպտում է և թափահարում ձեռքը",
    ],
  },
  tools: {
    title: "Գործիքներ",
    subtitle: "Բարելավիր որակը կամ հեռացրու ֆոնը մեկ սեղմումով։",
    placeholder: "",
    examples: [],
  },
};

const RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];

type Result = { id: string; status: "loading" | "done" | "error"; url?: string; error?: string; kind: "image" | "video"; prompt: string };

export default function Studio({ mode }: { mode: StudioMode }) {
  const copy = COPY[mode];
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [ratio, setRatio] = useState("1:1");
  const [enhance, setEnhance] = useState(true);
  const [tool, setTool] = useState<"upscale" | "remove-bg">("upscale");
  const [results, setResults] = useState<Result[]>([]);
  const [statusText, setStatusText] = useState("");

  const needsImage = mode === "edit" || mode === "tools";
  const allowsImage = needsImage || mode === "video";
  const busy = results.some((r) => r.status === "loading");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setImage(await fileToDataUrl(file));
  }

  async function generate() {
    if (busy) return;
    const task: Task = mode === "tools" ? tool : mode;
    const kind = mode === "video" ? "video" : "image";
    const id = crypto.randomUUID();
    const shownPrompt = mode === "tools" ? (tool === "upscale" ? "Որակի բարձրացում" : "Ֆոնի հեռացում") : prompt;
    setResults((r) => [{ id, status: "loading", kind, prompt: shownPrompt }, ...r]);

    try {
      let finalPrompt = prompt;
      if (mode !== "tools" && enhance && prompt.trim()) {
        setStatusText("Բարելավում եմ պրոմպտը…");
        finalPrompt = await enhancePrompt(prompt, mode);
      }
      setStatusText(mode === "video" ? "Ստեղծում եմ վիդեոն (կարող է տևել 1–5 րոպե)…" : "Ստեղծում եմ…");
      const url = await runGeneration(
        { task, prompt: finalPrompt, image: image ?? undefined, aspectRatio: ratio },
        (s) => setStatusText(s === "starting" ? "Մոդելը միանում է…" : "Աշխատում եմ…"),
      );
      setResults((r) => r.map((x) => (x.id === id ? { ...x, status: "done", url } : x)));
      const item: GalleryItem = { id, kind, task, url, prompt: shownPrompt, createdAt: Date.now() };
      saveToGallery(item);
    } catch (err) {
      const error = err instanceof Error ? err.message : "Սխալ";
      setResults((r) => r.map((x) => (x.id === id ? { ...x, status: "error", error } : x)));
    } finally {
      setStatusText("");
    }
  }

  const canSubmit = !busy && (needsImage ? Boolean(image) : true) && (mode === "tools" || prompt.trim().length > 0);

  return (
    <div className="studio">
      <header className="studio-head">
        <h1>{copy.title}</h1>
        <p className="muted">{copy.subtitle}</p>
      </header>

      <div className="studio-grid">
        <section className="panel">
          {allowsImage && (
            <label className={`drop ${image ? "has-image" : ""}`}>
              <input type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="Վերբեռնված նկար" />
              ) : (
                <span>
                  📤 Սեղմիր՝ նկար վերբեռնելու համար
                  {mode === "video" && <small>(ըստ ցանկության)</small>}
                </span>
              )}
            </label>
          )}
          {image && (
            <button className="link-btn" onClick={() => setImage(null)}>
              Հեռացնել նկարը
            </button>
          )}

          {mode === "tools" ? (
            <div className="segmented">
              <button className={tool === "upscale" ? "active" : ""} onClick={() => setTool("upscale")}>
                🔍 Որակի բարձրացում
              </button>
              <button className={tool === "remove-bg" ? "active" : ""} onClick={() => setTool("remove-bg")}>
                ✂️ Ֆոնի հեռացում
              </button>
            </div>
          ) : (
            <>
              <textarea
                className="prompt"
                value={prompt}
                rows={4}
                placeholder={copy.placeholder}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="chips">
                {copy.examples.map((ex) => (
                  <button key={ex} className="chip" onClick={() => setPrompt(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
              <div className="options">
                {mode === "image" && (
                  <label>
                    Չափս{" "}
                    <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
                      {RATIOS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="check">
                  <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} />
                  ✨ AI-ով բարելավել և թարգմանել պրոմպտը
                </label>
              </div>
            </>
          )}

          <button className="primary" disabled={!canSubmit} onClick={() => void generate()}>
            {busy ? "Սպասիր…" : mode === "video" ? "🎬 Ստեղծել վիդեո" : mode === "tools" ? "⚡ Կատարել" : "🎨 Ստեղծել"}
          </button>
          {statusText && <p className="status">{statusText}</p>}
        </section>

        <section className="results">
          {results.length === 0 ? (
            <div className="empty muted">Արդյունքները կհայտնվեն այստեղ</div>
          ) : (
            results.map((r) => (
              <figure key={r.id} className="result">
                {r.status === "loading" && <div className="skeleton">Ստեղծվում է…</div>}
                {r.status === "error" && <div className="error">⚠️ {r.error}</div>}
                {r.status === "done" &&
                  r.url &&
                  (r.kind === "video" ? (
                    <video src={r.url} controls autoPlay loop playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.url} alt={r.prompt} />
                  ))}
                <figcaption>
                  <span>{r.prompt}</span>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer" download>
                      ⬇️ Ներբեռնել
                    </a>
                  )}
                </figcaption>
              </figure>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
