// Warstwa LLM: wysyła prompt użytkownika do OpenRouter i wymusza JSON
// wg jawnego JSON Schema (poniżej). LLM NIE pisze SQL-a.

// Przykład prostego schematu — { is_ok: boolean, comment: string }.
// Taki kontrakt wystarcza do walidacji / moderacji odpowiedzi modelu.
const SIMPLE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_ok', 'comment'],
  properties: {
    is_ok: { type: 'boolean' },
    comment: { type: 'string', description: 'komentarz dla użytkownika' },
  },
};

// Jawna definicja struktury odpowiedzi — przekazywana do OpenRoutera
// jako response_format.json_schema. Zastępuje opis schematu w prompcie.
const INTENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['operation', 'table'],
  properties: {
    operation: {
      type: 'string',
      enum: ['create_table', 'select', 'insert', 'update', 'delete'],
    },
    table: { type: 'string' },

    // create_table
    columns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['integer', 'string', 'text', 'float', 'boolean', 'datetime'],
          },
          length: { type: 'integer', description: 'tylko dla string' },
          primary: { type: 'boolean' },
          autoIncrement: { type: 'boolean' },
          notNull: { type: 'boolean' },
          unique: { type: 'boolean' },
          default: {},
        },
      },
    },
    charset: {
      type: 'string',
      description: 'MySQL: ustaw gdy dane mogą zawierać polskie znaki (np. utf8mb4)',
    },
    collate: {
      type: 'string',
      description: 'MySQL: np. utf8mb4_polish_ci dla polskiego kontekstu',
    },

    // select
    select: {
      type: 'array',
      items: { type: 'string' },
      description: 'puste = SELECT *',
    },
    where: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['column', 'value'],
        properties: {
          column: { type: 'string' },
          op: { type: 'string', description: 'np. =, <, >, like; domyślnie =' },
          value: {},
        },
      },
    },
    orderBy: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['column'],
        properties: {
          column: { type: 'string' },
          direction: { type: 'string', enum: ['asc', 'desc'] },
        },
      },
    },
    limit: { type: 'integer' },

    // insert / update
    values: { type: 'object', additionalProperties: true },
    set: { type: 'object', additionalProperties: true },
  },
};

const SYSTEM_PROMPT = `Jesteś tłumaczem języka naturalnego na strukturalną INTENCJĘ zapytania do bazy danych.
Odpowiadasz wyłącznie obiektem JSON zgodnym z dostarczonym schematem — NIGDY nie generuj SQL-a.

Wskazówki semantyczne:
- Gdy tworzysz tabelę w kontekście polskojęzycznym, ustaw charset="utf8mb4" i collate="utf8mb4_polish_ci".
- Wartości w where/values/set to literalne dane — nigdy fragmenty SQL-a ani interpolacje.`;

async function askLLM(userPrompt, { apiKey, model }) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'query_intent', schema: INTENT_SCHEMA },
      },
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

module.exports = { askLLM, INTENT_SCHEMA };
