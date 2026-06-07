# 🟩 Wordle Online

Webová hra Wordle v slovenčine s online leaderboardom, autentifikáciou cez Firebase a možnosťou lokálneho backendu cez Flask + SQLite.

---

## 📋 Obsah

- [O projekte](#o-projekte)
- [Funkcie](#funkcie)
- [Technológie](#technológie)
- [Štruktúra projektu](#štruktúra-projektu)
- [Inštalácia a spustenie](#inštalácia-a-spustenie)
- [Herné pravidlá](#herné-pravidlá)
- [API endpointy](#api-endpointy)

---

## O projekte

**Wordle Online** je slovenská verzia populárnej hádanky slov. Hráč má 6 pokusov na uhádnutie tajného 5-písmenkového slova. Hra sleduje výsledky prihlásených hráčov a zobrazuje online rebríček najlepších skóre.

Projekt má **duálnu architektúru**:
- **Frontend** komunikuje priamo s **Firebase** (autentifikácia + databáza v reálnom čase)
- **Backend** (Flask + SQLite) je pripravený ako alternatívne riešenie pre lokálne nasadenie bez Firebase

---

## Funkcie

- 🎮 **Klasický Wordle gameplay** – 6 riadkov × 5 stĺpcov, farebná spätná väzba
- 🔐 **Registrácia a prihlásenie** cez Firebase Authentication (email + heslo)
- 🏆 **Online leaderboard** – top 10 hráčov zoradených podľa skóre v reálnom čase
- 💾 **Ukladanie rekordov** – skóre sa uloží iba ak je lepšie ako predchádzajúce
- ⌨️ **Fyzická klávesnica** aj klikacia klávesnica v UI
- 🔄 **Nová hra** kedykoľvek s potvrdením pri rozohranej partii
- 📱 **Responzívny dizajn** – funguje na mobile aj desktope
- 🌐 **Slovenská lokalizácia** – slová aj UI

---

## Technológie

| Vrstva | Technológia |
|--------|-------------|
| Frontend | Vanilla JS (ES Modules), HTML5, CSS3 |
| Autentifikácia | Firebase Authentication v10 |
| Databáza (live) | Firebase Realtime Database |
| Backend (alt.) | Python / Flask 3.x |
| Databáza (alt.) | SQLite 3 |
| Fonty | Google Fonts – Outfit |

---

## Štruktúra projektu

```
wordle-online/
├── app.py              # Flask backend – REST API, SQLite
├── requirements.txt    # Python závislosti (Flask)
├── wordle.db           # SQLite databáza (automaticky vytvorená)
├── templates/
│   └── index.html      # Hlavná HTML šablóna
└── static/
    ├── css/
    │   └── style.css   # Všetky štýly
    └── js/
        └── app.js      # Celý frontend – hra + Firebase
```

---

## Inštalácia a spustenie

### Požiadavky

- Python 3.8+
- pip

### Postup

```bash
# 1. Naklonuj repozitár
git clone <url-repozitara>
cd wordle-online

# 2. Nainštaluj závislosti
pip install -r requirements.txt

# 3. Spusti server
python app.py
```

Potom otvor prehliadač na adrese:

```
http://127.0.0.1:5000
```

> **Poznámka:** Flask backend zabezpečuje len servovanie HTML stránky a záložné API. Samotná hra a autentifikácia bežia priamo v prehliadači cez Firebase SDK.

---

## Herné pravidlá

1. Tajné slovo má vždy **5 písmen**
2. Hráč má **6 pokusov**
3. Po každom pokuse sa zobrazia farby:
   - 🟩 **Zelená** – písmeno je na správnom mieste
   - 🟨 **Žltá** – písmeno je v slove, ale na inom mieste
   - ⬜ **Sivá** – písmeno nie je v slove
4. Skóre = `počet_pokusov × 1000 + čas_v_sekundách` (nižšie = lepšie)
5. Ukladá sa iba **osobný rekord** (najlepšie dosiahnuté skóre)

---

## API endpointy

> Tieto endpointy sú súčasťou Flask backendu – slúžia ako alternatíva k Firebase.

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| `POST` | `/api/register` | Registrácia nového používateľa |
| `POST` | `/api/login` | Prihlásenie |
| `POST` | `/api/logout` | Odhlásenie |
| `GET`  | `/api/me` | Informácie o aktuálnom používateľovi |
| `GET`  | `/api/word/random` | Náhodné slovo z databázy |
| `POST` | `/api/score` | Uloženie skóre (iba ak je rekord) |
| `GET`  | `/api/leaderboard` | Top 10 hráčov |
