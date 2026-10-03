# ✨ HrantSi

**HrantSi**-ը հայկական AI հարթակ է՝ Claude-ի և ChatGPT-ի նման, բայց մեկ տեղում.

| Բաժին | Ինչ է անում | Ինչով է աշխատում |
|---|---|---|
| 💬 **Զրույց** | Խոսիր AI-ի հետ հայերեն, կցիր նկարներ, որ վերլուծի | Claude (Anthropic) |
| 🎨 **Նկար** | Գրիր նկարագրություն → ստացիր ռեալիստիկ նկար | FLUX 1.1 Pro Ultra (raw ռեժիմ) |
| 🪄 **Խմբագրել** | Վերբեռնիր քո նկարը և գրիր «տեղափոխիր ինձ Փարիզ», «փոխիր ֆոնը», «հագցրու կոստյում» | FLUX Kontext Pro |
| 🎬 **Վիդեո** | Տեքստից վիդեո, կամ նկարից «կենդանի» վիդեո | MiniMax Hailuo 02 |
| 🧰 **Գործիքներ** | Որակի բարձրացում, ֆոնի հեռացում | Recraft Crisp Upscale, Bria Remove BG |
| 🖼️ **Պատկերասրահ** | Քո բոլոր ստեղծածները | բրաուզերի հիշողություն |

✨ **AI պրոմպտի բարելավում** — հայերեն գրածդ Claude-ը ավտոմատ թարգմանում և հարստացնում է անգլերեն մանրամասն պրոմպտի, որ նկարները լինեն ավելի ռեալիստիկ։

## 🚀 Ինչպես գործարկել

### 1. Ստացիր API բանալիները

- **Anthropic (Claude)** — https://console.anthropic.com/settings/keys
- **Replicate** (նկար/վիդեո) — https://replicate.com/account/api-tokens

> Երկու ծառայություններն էլ վճարովի են՝ ըստ օգտագործման։ Գները տես Replicate-ի յուրաքանչյուր մոդելի էջում։

### 2. Տեղական գործարկում

```bash
cd hrantsi
npm install
cp .env.example .env.local   # և լրացրու բանալիները
npm run dev
```

Բացիր http://localhost:3000

### 3. Հրապարակում ինտերնետում (Vercel)

1. Գնա https://vercel.com → **Add New Project** → ընտրիր այս ռեպոն
2. **Root Directory**՝ `hrantsi`
3. **Environment Variables**-ում ավելացրու `ANTHROPIC_API_KEY` և `REPLICATE_API_TOKEN`
4. Սեղմիր **Deploy** — կստանաս հղում, օր․՝ `hrantsi.vercel.app`

## ⚙️ Մոդելների փոխարինում

Ցանկացած մոդել կարելի է փոխել առանց կոդի՝ `.env.local`-ում (տես `.env.example`)։
Եթե նոր մոդելի մուտքային դաշտերը տարբեր են, թարմացրու `lib/replicate.ts`-ի `buildInput`-ը։

## 📁 Կառուցվածք

```
hrantsi/
├─ app/page.tsx               — հիմնական էջ և մենյու
├─ app/api/chat               — Claude զրույց (streaming)
├─ app/api/enhance            — պրոմպտի բարելավում
├─ app/api/generate           — նկար / խմբագրում / վիդեո / գործիքներ
├─ app/api/prediction/[id]    — գեներացիայի կարգավիճակ
├─ components/                — Chat, Studio, Gallery
└─ lib/                       — Claude և Replicate կապեր
```

## ⚠️ Կարևոր

- Replicate-ի արդյունքների հղումները ժամանակավոր են (մոտ 1 ժամ)․ **ներբեռնիր** կարևոր նկարներն ու վիդեոները։
- Մի օգտագործիր ուրիշի լուսանկարները առանց նրա թույլտվության։

## ✍️ Հեղինակ

**HrantSi**-ը ստեղծել է **Kristine Martirosyan**-ը ([@kristinemartirosyan2021-lgtm](https://github.com/kristinemartirosyan2021-lgtm))։
