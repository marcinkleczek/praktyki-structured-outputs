// Warstwa LLM: wysyła prompt użytkownika do OpenRouter i wymusza JSON
// o ściśle określonej strukturze (intent). LLM NIE pisze SQL-a.
const SYSTEM_PROMPT = `Jesteś tłumaczem języka naturalnego na strukturalną INTENCJĘ zapytania do bazy danych.
NIGDY nie generuj SQL. Zwracaj wyłącznie JSON o poniższym schemacie:

{
  "operation": "create_table" | "select" | "insert" | "update" | "delete",
  "table": "nazwa_tabeli",

  // dla create_table:
  "columns": [
    {
      "name": "string",
      "type": "integer" | "string" | "text" | "float" | "boolean" | "datetime",
      "length": number,          // opcjonalne, tylko dla string
      "primary": boolean,
      "autoIncrement": boolean,
      "notNull": boolean,
      "unique": boolean,
      "default": any
    }
  ],
  "charset": "utf8mb4",          // TYLKO gdy dane mogą zawierać polskie znaki / emoji
  "collate": "utf8mb4_polish_ci",// TYLKO gdy kontekst jest polskojęzyczny

  // dla select:
  "select": ["kol1", "kol2"],    // puste lub pominięte = SELECT *
  "where":  [{ "column": "x", "op": "=", "value": 1 }],
  "orderBy":[{ "column": "x", "direction": "asc" | "desc" }],
  "limit":  10,

  // dla insert:
  "values": { "kol": "wart", ... },

  // dla update:
  "set":    { "kol": "wart", ... },
  "where":  [...]                 // jak wyżej
}

ZASADY:
- Zawsze gdy tworzysz tabelę w kontekście polskim, DODAJ charset i collate.
- Wartości w where/values/set to wartości literalne — nie interpolacje, nie SQL.
- Zwróć WYŁĄCZNIE obiekt JSON, bez komentarzy, bez markdown, bez tekstu przed/po.`;

async function askLLM(userPrompt, { apiKey, model }) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Pusta odpowiedź modelu');
  return {
    raw: content,
    intent: JSON.parse(content),
    model: data.model,
    usage: data.usage,
  };
}

module.exports = { askLLM };
