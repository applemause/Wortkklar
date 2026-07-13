type PagesContext = {
  request: Request;
  env: {
    apikey?: string;
    APIKEY?: string;
    GROQ_API_KEY?: string;
  };
};

const systemPrompt = `Ты — точный русско-немецкий учебный переводчик для русскоязычного ученика.
Верни только JSON без markdown в формате:
{
  "translation": "основной естественный перевод",
  "explanation": "краткое полезное пояснение",
  "entries": [
    {
      "type": "noun|verb|adjective|phrase|other",
      "word": "слово или выражение на немецком",
      "translation": "перевод на русский",
      "article": "der|die|das|null",
      "plural": "форма множественного числа или null",
      "gender": "maskulin|feminin|neutral|null",
      "infinitive": "инфинитив или null",
      "preterite": "Präteritum или null",
      "participle": "Partizip II без вспомогательного глагола или null",
      "auxiliary": "haben|sein|null",
      "comparative": "Komparativ или null",
      "superlative": "Superlativ или null",
      "government": "управление с предлогом и падежом или null",
      "examples": [
        { "german": "естественный пример на немецком", "russian": "перевод на русский" },
        { "german": "второй пример на немецком", "russian": "перевод на русский" },
        { "german": "третий пример на немецком", "russian": "перевод на русский" }
      ]
    }
  ]
}
Правила:
- Поле translation содержит только один основной естественный перевод на целевом языке. Не повторяй исходное слово, не добавляй тире, слеши, подписи и пояснения.
- Все explanation и entries[].translation пиши только по-русски.
- Немецкий язык используй только в entries[].word, грамматических формах, government и examples[].german.
- examples[].russian всегда пиши по-русски. Дай ровно три коротких, естественных и разных примера уровня A2-B1.
- Для одного слова возвращай ровно один entry.
- При переводе с русского на немецкий всегда разбирай ключевые немецкие слова результата.
- Если основной немецкий перевод — существительное, translation обязательно начинай с артикля der, die или das.
- Для существительных обязательно указывай артикль и множественное число без артикля die в поле plural.
- Для глаголов обязательно указывай Infinitiv, Präteritum, Partizip II и haben/sein.
- Для отделяемых и возвратных глаголов показывай полную словарную форму. У отделяемых глаголов указывай корректную форму Präteritum, например "bog ab", и Partizip II.
- Для простого однозначного слова оставляй explanation пустой строкой. Заполняй его только если нужно коротко различить значения или употребление; не давай общих определений и не описывай типичные склонения.
- Не придумывай редкие значения без необходимости.
- Пояснение должно быть коротким и понятным ученику A2-B1.
- JSON должен быть валидным.`;

const allowedModels = new Set([
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b"
]);

const translationSchema = {
  type: "object",
  properties: {
    translation: { type: "string" },
    explanation: { type: "string" },
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["noun", "verb", "adjective", "phrase", "other"] },
          word: { type: "string" },
          translation: { type: "string" },
          article: { type: ["string", "null"], enum: ["der", "die", "das", null] },
          plural: { type: ["string", "null"] },
          gender: { type: ["string", "null"], enum: ["maskulin", "feminin", "neutral", null] },
          infinitive: { type: ["string", "null"] },
          preterite: { type: ["string", "null"] },
          participle: { type: ["string", "null"] },
          auxiliary: { type: ["string", "null"], enum: ["haben", "sein", null] },
          comparative: { type: ["string", "null"] },
          superlative: { type: ["string", "null"] },
          government: { type: ["string", "null"] },
          examples: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                german: { type: "string" },
                russian: { type: "string" }
              },
              required: ["german", "russian"],
              additionalProperties: false
            }
          }
        },
        required: [
          "type", "word", "translation", "article", "plural", "gender",
          "infinitive", "preterite", "participle", "auxiliary", "comparative",
          "superlative", "government", "examples"
        ],
        additionalProperties: false
      }
    }
  },
  required: ["translation", "explanation", "entries"],
  additionalProperties: false
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    const body = await context.request.json() as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const sourceLanguage: "ru" | "de" = /[А-Яа-яЁё]/.test(text) ? "ru" : "de";
    const targetLanguage: "ru" | "de" = sourceLanguage === "ru" ? "de" : "ru";
    const apiKey = (
      context.env.apikey ??
      context.env.APIKEY ??
      context.env.GROQ_API_KEY ??
      ""
    ).trim();
    const requestedModel = typeof body.model === "string" ? body.model.trim() : "";
    const model = allowedModels.has(requestedModel) ? requestedModel : "openai/gpt-oss-20b";

    if (!text) return json({ error: "Введите текст для перевода." }, 400);
    if (!apiKey) return json({ error: "Секрет Groq API не настроен на сервере." }, 500);

    const userPrompt = sourceLanguage === "ru"
      ? `Исходный язык: русский. Целевой язык: немецкий. Переведи и разбери немецкий результат. Все пояснения дай по-русски. Текст: ${text}`
      : `Исходный язык: немецкий. Целевой язык: русский. Переведи и разбери немецкий оригинал. Все пояснения дай по-русски. Текст: ${text}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        reasoning_effort: "low",
        max_completion_tokens: 2200,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "translation_result",
            strict: true,
            schema: translationSchema
          }
        }
      })
    });

    const payload = await response.json() as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!response.ok) {
      return json({ error: payload.error?.message || "Groq API вернул ошибку." }, response.status);
    }

    const outputText = payload.choices?.[0]?.message?.content;

    if (!outputText) return json({ error: "Модель не вернула текстовый ответ." }, 502);

    const cleaned = outputText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { translation?: string; explanation?: string; entries?: unknown[] };

    if (!parsed.translation || !Array.isArray(parsed.entries)) {
      return json({ error: "Ответ модели имеет неверный формат." }, 502);
    }

    return json({ ...parsed, sourceLanguage, targetLanguage });
  } catch (error) {
    const message = error instanceof SyntaxError
      ? "Модель вернула некорректный JSON. Повторите запрос."
      : error instanceof Error ? error.message : "Неизвестная ошибка.";
    return json({ error: message }, 500);
  }
}
