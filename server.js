require('dotenv').config();
const express = require('express');
const path = require('path');
const { sqlite, mysql, buildQuery } = require('./lib/db');
const { askLLM } = require('./lib/llm');
const { format } = require('sql-formatter');

const FMT = { keywordCase: 'upper', linesBetweenQueries: 1, tabWidth: 2 };
const pretty = (q, lang) => ({ ...q, sql: format(q.sql, { language: lang, ...FMT }) });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/build', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Brak prompt-a' });

    const llm = await askLLM(prompt, {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.5',
    });

    const sqliteSQL = pretty(buildQuery(sqlite, llm.intent), 'sqlite');
    const mysqlSQL = pretty(buildQuery(mysql, llm.intent), 'mysql');

    res.json({
      raw: llm.raw,
      intent: llm.intent,
      model: llm.model,
      usage: llm.usage,
      sqlite: sqliteSQL,
      mysql: mysqlSQL,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`→ http://localhost:${PORT}`));
