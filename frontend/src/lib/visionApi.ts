import type { AnalysisResult, FoodItem } from '../types';

const VISION_PROMPT = `Jesteś precyzyjnym asystentem dietetycznym analizującym zdjęcia posiłków.

ZADANIE: Zidentyfikuj wszystkie produkty spożywcze widoczne na zdjęciu i oszacuj ich wartości odżywcze.

ZASADY:
1. Podawaj ZAKRESY (min–max) – to uczciwy szacunek, nie precyzyjny pomiar
2. Szacuj gramaturę na podstawie: rozmiaru naczynia, standardowych porcji, proporcji na zdjęciu
3. Uwzględnij sposób przygotowania (surowe/gotowane/smażone ma wpływ na kcal)
4. Confidence: 0.9+ wyraźnie widoczne i pewne, 0.7–0.9 prawdopodobne, 0.5–0.7 niepewne, <0.5 zgadywanie

PRZYPADKI SPECJALNE:
- Nieczytelne/rozmazane zdjęcie → {"success": false, "error": "Zdjęcie niewyraźne – zrób wyraźniejsze"}
- Brak jedzenia na zdjęciu → {"success": false, "error": "Nie wykryto jedzenia na zdjęciu"}
- Zamknięte opakowanie/pojemnik → podaj jako jedną pozycję z confidence 0.2 i bardzo szerokimi zakresami
- Danie mieszane (zupa, sałatka) → możesz podać całość jako jedną pozycję lub rozdzielić składniki

Odpowiedz WYŁĄCZNIE czystym JSON (zero tekstu poza JSON, zero backticks, zero markdown):
{
  "success": true,
  "items": [
    {
      "name": "Kurczak pieczony",
      "description": "Pierś z kurczaka bez skóry, pieczona w piekarniku",
      "quantity_g": {"min": 150, "max": 180},
      "kcal": {"min": 165, "max": 198},
      "protein_g": {"min": 31, "max": 37},
      "carbs_g": {"min": 0, "max": 1},
      "fat_g": {"min": 3, "max": 5},
      "confidence": 0.85
    }
  ],
  "overall_confidence": 0.8,
  "notes": "Opcjonalny komentarz o warunkach analizy",
  "error": null
}`;

function parseVisionJson(raw: string): AnalysisResult {
  let clean = raw.trim();
  // Strip markdown fences if the model added them despite instructions
  clean = clean.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  const data = JSON.parse(clean);

  // Add IDs to items
  const items: FoodItem[] = (data.items || []).map((item: FoodItem) => ({
    ...item,
    id: item.id || Math.random().toString(36).slice(2) + Date.now().toString(36),
  }));

  return {
    success: data.success ?? true,
    items,
    overall_confidence: data.overall_confidence ?? 0.7,
    notes: data.notes ?? undefined,
    error: data.error ?? undefined,
  };
}

async function analyzeWithClaude(
  imageBase64: string,
  mediaType: string,
  apiKey: string,
  model: string,
): Promise<AnalysisResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            { type: 'text', text: VISION_PROMPT },
          ],
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data?.error?.message || `HTTP ${response.status}`;
    if (response.status === 401) throw new Error('Nieprawidłowy klucz API Anthropic');
    if (response.status === 429) throw new Error('Przekroczono limit API – poczekaj chwilę');
    throw new Error(msg);
  }

  return parseVisionJson(data.content[0].text);
}

async function analyzeWithOpenAI(
  imageBase64: string,
  mediaType: string,
  apiKey: string,
  model: string,
): Promise<AnalysisResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mediaType};base64,${imageBase64}` },
            },
            { type: 'text', text: VISION_PROMPT },
          ],
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data?.error?.message || `HTTP ${response.status}`;
    if (response.status === 401) throw new Error('Nieprawidłowy klucz API OpenAI');
    if (response.status === 429) throw new Error('Przekroczono limit API – poczekaj chwilę');
    throw new Error(msg);
  }

  return parseVisionJson(data.choices[0].message.content);
}

export async function analyzeImage(
  imageBase64: string,
  mediaType: string,
  apiKey: string,
  provider: 'claude' | 'openai',
  model: string,
): Promise<AnalysisResult> {
  if (provider === 'claude') {
    return analyzeWithClaude(imageBase64, mediaType, apiKey, model);
  }
  return analyzeWithOpenAI(imageBase64, mediaType, apiKey, model);
}
