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
| 💎 **Կրեդիտներ** | Հաշվեկշիռ, գներ, փաթեթներ դրամով | Postgres |
| 🛠️ **Ադմին** | Վճարած օգտատերերին կրեդիտ ավելացնել | միայն ադմինների համար |

✨ **AI պրոմպտի բարելավում** — հայերեն գրածդ Claude-ը ավտոմատ թարգմանում և հարստացնում է անգլերեն մանրամասն պրոմպտի, որ նկարները լինեն ավելի ռեալիստիկ։

## 💎 Մուտք և կրեդիտներ

- Մարդը մտնում է **Google հաշվով** և ստանում անվճար կրեդիտներ (լռելյայն՝ 5)։
- Ամեն գործողություն արժե կրեդիտ՝ նկար/խմբագրում/գործիք՝ 1, վիդեո՝ 10։ Ձախողված գեներացիայի կրեդիտը վերադարձվում է ավտոմատ։
- Զրույցը անվճար է՝ օրական 30 հաղորդագրություն։
- **Վճարում (առայժմ ձեռքով).** գնորդը փոխանցում է գումարը քո Idram-ին կամ քարտին և նշում իր email-ը, դու «Ադմին» բաժնում ավելացնում ես կրեդիտը։
- Ավտոմատ վճարումը (Idram merchant կամ բանկի vPOS) կարելի է ավելացնել, երբ ունենաս merchant հաշիվ։

Բոլոր թվերը (գներ, արժեքներ, նվեր) փոխվում են `.env`-ով, տես `.env.example`։

## 🚀 Ինչպես գործարկել

### 1. Ստացիր բանալիները

- **Anthropic (Claude)** — https://console.anthropic.com/settings/keys
- **Replicate** (նկար/վիդեո) — https://replicate.com/account/api-tokens
- **Neon** (տվյալների բազա, անվճար) — https://neon.tech → նոր նախագիծ → պատճենիր connection string-ը `DATABASE_URL`-ի մեջ։ Աղյուսակները ստեղծվում են ինքնաբերաբար։
- **Google մուտք** — https://console.cloud.google.com/apis/credentials → *Create credentials → OAuth client ID → Web application*։
  *Authorized redirect URI*՝ `https://ՔՈ-ԿԱՅՔԸ/api/auth/callback/google` (տեղականում՝ `http://localhost:3000/api/auth/callback/google`)։
  Ստացված Client ID-ն և Secret-ը դիր `AUTH_GOOGLE_ID` և `AUTH_GOOGLE_SECRET`։
- **AUTH_SECRET** — ցանկացած երկար պատահական տեքստ (կամ `npx auth secret`)։

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
3. **Environment Variables**-ում ավելացրու `.env.example`-ի բոլոր լրացված փոփոխականները
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
├─ app/api/me, app/api/admin  — հաշիվ, կրեդիտներ, ադմին
├─ auth.ts                    — Google մուտք
├─ lib/billing.ts             — կրեդիտների տրամաբանություն
├─ components/                — Chat, Studio, Gallery, Credits, Admin
└─ lib/                       — Claude և Replicate կապեր
```

## ⚠️ Կարևոր

- Replicate-ի արդյունքների հղումները ժամանակավոր են (մոտ 1 ժամ)․ **ներբեռնիր** կարևոր նկարներն ու վիդեոները։
- Մի օգտագործիր ուրիշի լուսանկարները առանց նրա թույլտվության։

## ✍️ Հեղինակ

**HrantSi**-ը ստեղծել է **Kristine Martirosyan**-ը ([@kristinemartirosyan2021-lgtm](https://github.com/kristinemartirosyan2021-lgtm))։
