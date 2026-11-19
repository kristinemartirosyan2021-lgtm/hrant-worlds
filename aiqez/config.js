/*
 * AIQEZ Creative AI Studio — կայքի կարգավորումներ
 * ------------------------------------------------
 * Գներն ու ծառայությունները փոխելու համար խմբագրիր ՄԻԱՅՆ այս ֆայլը։
 *
 *  price: null      → կայքում կգրվի «Արժեքը՝ ըստ պատվերի»
 *  price: 15000     → կգրվի «15 000 ֏»
 *  priceFrom: true  → գնի առաջ կավելացվի «սկսած»  (օր.՝ «սկսած 15 000 ֏»)
 *  photosRequired: true    → առանց լուսանկարի պատվերը չի ընդունվի
 *  photosRecommended: true → կցուցադրվի խորհուրդ՝ կցել լուսանկար
 */
window.AIQEZ_CONFIG = {
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
      price: null,
      priceFrom: false,
      detailsHint:
        "Ո՞ւմ համար է երգը, ի՞նչ առիթով, ի՞նչ ոճով (փոփ, ռեփ, ժողովրդական…), ի՞նչ անուններ և պատմություններ ներառենք։",
    },
    {
      id: "video",
      icon: "video",
      title: "AI տեսանյութ",
      description:
        "Կարճ տեսանյութ քո գաղափարով՝ շնորհավորանք, գովազդ, պատմություն կամ կենդանացած լուսանկարներ։",
      price: null,
      priceFrom: false,
      detailsHint:
        "Ի՞նչ պետք է տեղի ունենա տեսանյութում, մոտավոր տևողությունը, ո՞ւր է տեղադրվելու (Instagram, TikTok…)։",
    },
    {
      id: "portrait",
      icon: "portrait",
      title: "AI դիմանկար և ֆոտոշարք",
      description:
        "Քո լուսանկարներից ստեղծված ոճային դիմանկարներ և ֆոտոշարքեր՝ տարբեր կերպարներով ու միջավայրերով։",
      price: null,
      priceFrom: false,
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
      price: null,
      priceFrom: false,
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
