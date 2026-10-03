"use client";

import { useEffect, useState } from "react";
import { loadGallery, removeFromGallery, type GalleryItem } from "@/lib/client";

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    const refresh = () => setItems(loadGallery());
    refresh();
    window.addEventListener("hrantsi-gallery", refresh);
    return () => window.removeEventListener("hrantsi-gallery", refresh);
  }, []);

  return (
    <div className="studio">
      <header className="studio-head">
        <h1>Պատկերասրահ</h1>
        <p className="muted">
          Քո ստեղծած նկարներն ու վիդեոները։ Ներբեռնիր կարևորները՝ հղումները ժամանակի ընթացքում կարող են հնանալ։
        </p>
      </header>
      {items.length === 0 ? (
        <div className="empty muted">Դեռ ոչինչ չկա։ Սկսիր «Նկար» բաժնից 🎨</div>
      ) : (
        <div className="gallery">
          {items.map((it) => (
            <figure key={it.id} className="result">
              {it.kind === "video" ? (
                <video src={it.url} controls loop playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.url} alt={it.prompt} loading="lazy" />
              )}
              <figcaption>
                <span>{it.prompt}</span>
                <span className="row">
                  <a href={it.url} target="_blank" rel="noreferrer" download>
                    ⬇️
                  </a>
                  <button className="link-btn" onClick={() => removeFromGallery(it.id)} title="Ջնջել">
                    🗑
                  </button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
