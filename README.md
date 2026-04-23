# Structured Outputs → SQL (demo)

Pokaz dla uczniów: **LLM nie pisze SQL-a**. Model (OpenRouter) zwraca ustrukturyzowany JSON opisujący *intencję* zapytania, a biblioteka [Knex.js](https://knexjs.org/) kompiluje z tego bezpieczny, sparametryzowany SQL — osobno dla SQLite i MySQL.

UI pokazuje cztery kroki obok siebie:
prompt → surowa odpowiedź modelu → sparsowany JSON → SQL (SQLite / MySQL z `utf8mb4_polish_ci`).

## Uruchomienie

```bash
cp .env.example .env      # wpisz OPENROUTER_API_KEY
npm install
npm start                 # http://localhost:3000
```

## Struktura

- `lib/llm.js` — wywołanie OpenRouter z `response_format: json_object` i schematem intencji w system prompcie
- `lib/db.js` — dwie instancje Knex (tylko do budowania SQL, bez realnego połączenia)
- `server.js` — Express, endpoint `/api/build`
- `public/index.html` — UI
