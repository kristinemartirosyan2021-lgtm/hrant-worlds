/*
 * AIQEZ Creative AI Studio — կայքի կարգավորումներ
 * ------------------------------------------------
 * Գներն ու ծառայությունները փոխելու համար խմբագրիր ՄԻԱՅՆ այս ֆայլը։
 *
 *  Յուրաքանչյուր ծառայություն ունի packages (փաթեթներ)՝
 *    { id: "song-2m", title: "2 րոպե", price: 25000 }   → «25 000 ֏», քարտով վճարում
 *    { id: "…", title: "…", price: null }                → «Արժեքը ճշտել», հայտ առանց գանձման
 *    validUntil: "2026-11-30T23:59:59.999+04:00"         → գինը գործում է մինչև այդ պահը
 *                                                          (Երևանի ժամով), հետո՝ expiredLabel
 *  id-ն մի փոխիր արդեն ստացված պատվերներից հետո. սերվերը գինը գտնում է id-ով։
 *  Գինը փոխելուց հետո կայքը պետք է նորից հրապարակել։
 *  photosRequired: true    → առանց լուսանկարի պատվերը չի ընդունվի
 *  photosRecommended: true → կցուցադրվի խորհուրդ՝ կցել լուսանկար
 *
 * Քարտով վճարումը հասանելի է միայն գործող գնով փաթեթների համար։
 * Սերվերը (Netlify Functions) գումարը վերցնում է հենց այս ֆայլից (pricing.js-ի կանոններով)։
 */
var AIQEZ_CONFIG = {
  studioName: "AIQEZ",
  studioTagline: "Creative AI Studio",
  currency: "֏",

  /*
   * Պատվերների ուղարկում։
   *  demoMode: true  → փորձնական ռեժիմ. ոչինչ չի ուղարկվում և չի պահպանվում։
   *  demoMode: false → պատվերը ուղարկվում է Netlify Forms (կայքի «order» ձևը),
   *                    պահվում է Netlify-ի Forms բաժնում՝ կցված նկարներով։
   */
  demoMode: false,
  netlifyFormName: "order",
  orderEndpoint: "/",

  /*
   * Լուսանկարներ։ Netlify Forms-ը ընդունում է մեկ ֆայլ յուրաքանչյուր դաշտում
   * (photo1…photo5) և մինչև 8 ՄԲ ամբողջ հարցման համար։ Ուղարկելուց առաջ
   * նկարները փոքրացվում են հեռախոսում (մինչև photoMaxSide պիքսել, JPEG)։
   */
  maxPhotos: 5,            // պետք է համապատասխանի index.html-ի photo1…photoN դաշտերին
  maxPhotoSizeMB: 25,      // մեկ ընտրված նկարի առավելագույն չափը՝ մինչև փոքրացնելը
  maxUploadMB: 7,          // բոլոր նկարները միասին՝ փոքրացնելուց հետո (Netlify-ի սահմանը՝ 8 ՄԲ)
  photoMaxSide: 2048,
  photoQuality: 0.85,

  // Պատրաստման նվազագույն ժամկետ (օրերով)՝ ամսաթվի ընտրության համար
  minLeadDays: 1,

  services: [
    {
      id: "song",
      icon: "music",
      title: "Անհատական AI երգ",
      description:
        "Քո պատմությամբ, անուններով և հիշողություններով գրված երգ՝ ծննդյան օրվա, հարսանիքի կամ ցանկացած առիթի համար։",
      packages: [
        { id: "song-1m", title: "1 րոպե", price: 15000 },
        { id: "song-2m", title: "2 րոպե", price: 25000 },
        { id: "song-3m", title: "3 րոպե", price: 35000 },
      ],
      detailsHint:
        "Ո՞ւմ համար է երգը, ի՞նչ առիթով, ի՞նչ ոճով (փոփ, ռեփ, ժողովրդական…), ի՞նչ անուններ և պատմություններ ներառենք։",
    },
    {
      id: "video",
      icon: "video",
      title: "AI տեսանյութ",
      description:
        "Կարճ տեսանյութ քո գաղափարով՝ շնորհավորանք, գովազդ, պատմություն կամ կենդանացած լուսանկարներ։",
      packages: [
        { id: "video-15s", title: "Կարճ՝ 15 վայրկյան", price: 10000 },
        { id: "video-1m", title: "1 րոպե", price: 15000 },
        { id: "video-2m", title: "2 րոպե", price: 25000 },
        { id: "video-3m", title: "3 րոպե", price: 35000 },
        { id: "video-custom", title: "Ավելի երկար կամ հատուկ նախագիծ", price: null },
      ],
      detailsHint:
        "Ի՞նչ պետք է տեղի ունենա տեսանյութում, մոտավոր տևողությունը, ո՞ւր է տեղադրվելու (Instagram, TikTok…)։",
    },
    {
      id: "portrait",
      icon: "portrait",
      title: "AI դիմանկար և ֆոտոշարք",
      description:
        "Քո լուսանկարներից ստեղծված ոճային դիմանկարներ և ֆոտոշարքեր՝ տարբեր կերպարներով ու միջավայրերով։",
      packages: [
        { id: "portrait-1", title: "Մեկ նկար", price: 5000 },
        { id: "portrait-set", title: "Ֆոտոշարք", price: null },
      ],
      photosRequired: true,
      detailsHint:
        "Ի՞նչ ոճ ես ուզում (դասական, ֆանտաստիկ, բիզնես…), քանի՞ նկար, ո՞ւմ դիմանկարն է։ Կցիր 3–10 պարզ լուսանկար։",
    },
    {
      id: "santa",
      icon: "gift",
      title: "Ձմեռ պապի անհատական շնորհավորանք",
      description:
        "Ձմեռ պապը դիմում է երեխային անունով, հիշում նրա հաջողություններն ու երազանքները։",
      packages: [
        {
          id: "santa-30s",
          title: "30 վայրկյան, մեկ երեխայի համար",
          price: 10000,
          // Ակցիա՝ մինչև 2026-ի նոյեմբերի 30-ը ներառյալ (Երևանի ժամով, UTC+4)
          validUntil: "2026-11-30T23:59:59.999+04:00",
          promoNote: "Ակցիա՝ մինչև նոյեմբերի 30-ը ներառյալ",
          expiredLabel: "Ճշտել արժեքը",
        },
      ],
      photosRecommended: true,
      detailsHint:
        "Երեխայի անունը և տարիքը, ինչո՞վ է հպարտանում, ի՞նչ է երազում, ի՞նչ խորհուրդ տա Ձմեռ պապը։",
    },
  ],

  languages: [
    { id: "hy", label: "Հայերեն" },
    { id: "ru", label: "Ռուսերեն" },
    { id: "en", label: "Անգլերեն" },
  ],
};

// Կայքի էջերի և սերվերի (Netlify Functions) համար
if (typeof window !== "undefined") window.AIQEZ_CONFIG = AIQEZ_CONFIG;
if (typeof module !== "undefined" && module.exports) module.exports = AIQEZ_CONFIG;
