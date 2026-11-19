/*
 * Պատվերի ուղարկման շերտ։
 *
 * Հիմա կայքը փորձնական ռեժիմում է. այս ֆունկցիան ՈՉԻՆՉ չի ուղարկում
 * և վերադարձնում է { status: "demo" }, որպեսզի ինտերֆեյսը երբեք
 * չներկայացնի պատվերը որպես հաջող ուղարկված։
 *
 * Իրական միացման համար (հետագա քայլեր).
 *  1. Սերվեր/ֆունկցիա, որը պահում է պատվերը տվյալների բազայում,
 *     իսկ լուսանկարները՝ ֆայլերի պահոցում։
 *  2. Նույն սերվերը ծանուցում է ուղարկում տիրոջը (օր.՝ Telegram բոտ կամ email)։
 *     Բոտի token-ը և գաղտնի բանալիները պետք է պահվեն ՄԻԱՅՆ սերվերում, ոչ այստեղ։
 *  3. Սերվերը, անհրաժեշտության դեպքում, ստեղծում է վճարման սեսիա
 *     վճարային ծառայությունում և վերադարձնում paymentUrl, որին
 *     հաճախորդը կուղղորդվի։ Քարտի տվյալները կայքը երբեք չի տեսնում։
 *
 * Սերվերից սպասվող պատասխանը՝ { orderId: "A-1024", paymentUrl?: "https://..." }
 */
window.AIQEZ_submitOrder = async function submitOrder(order, photos) {
  var cfg = window.AIQEZ_CONFIG;

  if (cfg.demoMode || !cfg.orderEndpoint) {
    // Փորձնական ռեժիմ. ցանցային հարցում չի կատարվում։
    return { status: "demo" };
  }

  var body = new FormData();
  body.append("order", JSON.stringify(order));
  photos.forEach(function (file) { body.append("photos", file, file.name); });

  try {
    var res = await fetch(cfg.orderEndpoint, { method: "POST", body: body });
    if (!res.ok) return { status: "error" };
    var data = await res.json();
    if (!data || !data.orderId) return { status: "error" };
    return { status: "ok", orderId: data.orderId, paymentUrl: data.paymentUrl || null };
  } catch (e) {
    return { status: "error" };
  }
};
