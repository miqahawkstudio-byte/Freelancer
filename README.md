# CalorieVision – Kalorie ze zdjęcia posiłku

Aplikacja webowa (mobile-first) szacująca kalorie i makroskładniki z fotografii posiłku przy użyciu **AI Vision** (Claude claude-sonnet-4-6 lub GPT-4o). Dane przechowywane lokalnie w przeglądarce.

## Funkcje

- Zdjęcie lub import z galerii → automatyczne rozpoznanie produktów
- Kalorie jako **zakres min–max** + poziom pewności (uczciwy szacunek, nie fałszywa precyzja)
- Każda pozycja **edytowalna** przed zapisem (nazwa, gramatura, kcal, makro)
- Dziennik dnia: suma kcal/makro, pasek postępu względem celu
- Profil: waga, wzrost, wiek, aktywność, cel — automatyczne przeliczanie celów
- Historia tygodnia z wykresem słupkowym SVG
- Ręczne dodanie posiłku bez zdjęcia
- Interfejs w **języku polskim**

## Stos technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Python FastAPI (proxy do Vision API) |
| Vision AI | Claude claude-sonnet-4-6 (Anthropic) lub GPT-4o (OpenAI) |
| Dane | localStorage (profil, dziennik, ustawienia) |

## Wymagania

- Python 3.10+
- Node.js 18+
- Klucz API: [console.anthropic.com](https://console.anthropic.com) (Claude) lub [platform.openai.com](https://platform.openai.com) (OpenAI)

## Uruchomienie lokalne

```bash
chmod +x start.sh
./start.sh
```

Otwórz [http://localhost:5173](http://localhost:5173) w przeglądarce.
Skonfiguruj klucz API w aplikacji: **Profil → Ustawienia**.

## Uruchomienie z Docker

```bash
docker-compose up --build
```

## Architektura przepływu

```
Użytkownik → Zdjęcie → CameraScreen (kompresja JPEG)
    → ResultScreen → POST /api/analyze (FastAPI)
        → Claude/GPT-4o Vision API
        → JSON: { items: [{name, quantity_g, kcal, protein, carbs, fat, confidence}] }
    → Ekran edycji → Zapisz → localStorage
    → DiaryScreen (dziennik) / HistoryScreen (historia)
```

## Schemat danych

```typescript
// Zakres – rdzeń uczciwości szacunków
interface Range { min: number; max: number; }

// Pozycja posiłku
interface FoodItem {
  id: string; name: string; description?: string;
  quantity_g: Range; kcal: Range;
  protein_g: Range; carbs_g: Range; fat_g: Range;
  confidence: number; // 0–1
}

// Posiłek
interface Meal {
  id: string; date: string; timestamp: number;
  items: FoodItem[]; totals: MealTotals;
  source: 'photo' | 'manual';
  overall_confidence: number;
}
```

## Prompt vision (uproszczony)

Model otrzymuje zdjęcie + instrukcję w języku polskim nakazującą:
- Podanie zakresów (min-max), nie pojedynczych liczb
- Zwrócenie błędu jeśli zdjęcie nieczytelne lub brak jedzenia
- Ocenę pewności (confidence) per produkt
- Odpowiedź wyłącznie jako czysty JSON

## Zastrzeżenia o dokładności

Aplikacja jest transparentna w kwestii ograniczeń:
- Szacunki kaloryczne mogą być niedokładne o **±20–30%**
- Dlatego podajemy **zakresy** (np. 320–410 kcal), nie pojedynczą liczbę
- Każda pozycja jest **ręcznie edytowalna**
- Nie zastępuje porady dietetyka ani pomiarów medycznych

## Struktura projektu

```
├── backend/
│   ├── main.py           # FastAPI + Claude/OpenAI Vision proxy
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx               # Główna aplikacja SPA
│       ├── types.ts              # Typy TypeScript
│       ├── lib/
│       │   ├── storage.ts        # localStorage helpers
│       │   ├── utils.ts          # Formatowanie, obliczenia
│       │   └── imageUtils.ts     # Kompresja obrazu (Canvas API)
│       └── components/
│           ├── Navigation.tsx    # Dolna nawigacja
│           ├── screens/          # Ekrany aplikacji
│           │   ├── DiaryScreen.tsx
│           │   ├── CameraScreen.tsx
│           │   ├── ResultScreen.tsx
│           │   ├── HistoryScreen.tsx
│           │   ├── ProfileScreen.tsx
│           │   ├── SettingsScreen.tsx
│           │   └── ManualEntryScreen.tsx
│           └── ui/               # Komponenty UI
│               ├── CalorieBar.tsx
│               ├── MacroBar.tsx
│               ├── ConfidenceBadge.tsx
│               ├── MealCard.tsx
│               └── WeeklyChart.tsx
└── start.sh
```
