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
  "kind": "term|sentence",
  "correctedInput": "исправленный исходный текст или null",
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
- Сначала исправь орфографию исходного текста. correctedInput содержит только исправленный исходный текст, если он отличается хотя бы регистром или буквой; иначе null. Никогда не помещай туда перевод.
- kind="sentence" для полноценного предложения. Для предложения верни только translation, correctedInput при необходимости, пустую explanation и пустой массив entries. Не делай словарный разбор и не создавай примеры.
- kind="term" для одного слова или короткого словарного выражения. Для него верни от одного до трёх entries и по три примера для каждого.
- Первый entry — основное, самое частое значение и должен соответствовать полю translation.
- Добавляй второй или третий entry только для действительно частых самостоятельных значений или частых вариантов перевода. Не добавляй редкие, книжные и устаревшие значения и не заполняй список близкими синонимами ради количества.
- При переводе немецкого слова на русский для разных значений можно повторять немецкое entry.word, но entries[].translation должны ясно и коротко различать русские значения.
- При переводе русского слова на немецкий каждое частое немецкое соответствие оформляй отдельным entry со своей грамматикой.
- Поле translation содержит только один основной естественный перевод на целевом языке. Не повторяй исходное слово, не добавляй тире, слеши, подписи и пояснения.
- Если целевой язык русский, translation никогда не должен начинаться с немецкого артикля der, die или das. Артикль указывай только в немецких словарных данных entry.
- Все explanation и entries[].translation пиши только по-русски.
- Немецкий язык используй только в entries[].word, грамматических формах, government и examples[].german.
- examples[].russian всегда пиши по-русски. Для каждого entry дай ровно три коротких, естественных и разных примера уровня A2-B1, показывающих именно это значение. Не смешивай разные значения в примерах одного entry.
- При переводе с русского на немецкий всегда разбирай ключевые немецкие слова результата.
- Если основной немецкий перевод — существительное, translation обязательно начинай с артикля der, die или das.
- Для немецкого существительного всегда нормализуй entry.word в единственное число и укажи его артикль, даже если пользователь ввёл множественное число. В plural укажи множественное число без артикля die.
- Для глаголов обязательно указывай Infinitiv, Präteritum, Partizip II и haben/sein.
- Для отделяемых и возвратных глаголов показывай полную словарную форму. У отделяемых глаголов указывай корректную форму Präteritum, например "bog ab", и Partizip II.
- Для простого однозначного слова оставляй explanation пустой строкой. Заполняй его только если нужно коротко различить значения или употребление; не давай общих определений и не описывай типичные склонения.
- Не придумывай редкие значения без необходимости.
- Пояснение должно быть коротким и понятным ученику A2-B1.
- JSON должен быть валидным.`;

const translationSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["term", "sentence"] },
    correctedInput: { type: ["string", "null"] },
    translation: { type: "string" },
    explanation: { type: "string" },
    entries: {
      type: "array",
      maxItems: 3,
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
  required: ["kind", "correctedInput", "translation", "explanation", "entries"],
  additionalProperties: false
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

type ParsedTranslation = {
  kind?: "term" | "sentence";
  correctedInput?: string | null;
  translation?: string;
  explanation?: string;
  entries?: unknown[];
};

function hasExpectedLanguage(value: string, targetLanguage: "ru" | "de") {
  const hasCyrillic = /[А-Яа-яЁё]/.test(value);
  return targetLanguage === "ru" ? hasCyrillic : !hasCyrillic && /[A-Za-zÄÖÜäöüß]/.test(value);
}

function normalizeTranslation(value: string, targetLanguage: "ru" | "de") {
  return targetLanguage === "ru"
    ? value.replace(/^(der|die|das)\s+(?=[А-Яа-яЁё])/i, "").trim()
    : value.trim();
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
    const model = "openai/gpt-oss-120b";

    if (!text) return json({ error: "Введите текст для перевода." }, 400);
    if (!apiKey) return json({ error: "Секрет Groq API не настроен на сервере." }, 500);

    const userPrompt = sourceLanguage === "ru"
      ? `Исходный язык: русский. Целевой язык: немецкий. Переведи и разбери немецкий результат. Все пояснения дай по-русски. Текст: ${text}`
      : `Исходный язык: немецкий. Целевой язык: русский. Переведи и разбери немецкий оригинал. Все пояснения дай по-русски. Текст: ${text}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retryInstruction = attempt === 0 ? "" : targetLanguage === "ru"
        ? "\nКРИТИЧЕСКИ ВАЖНО: предыдущий ответ был отклонён, потому что translation был не на русском. Верни translation только на русском языке."
        : "\nКРИТИЧЕСКИ ВАЖНО: предыдущий ответ был отклонён, потому что translation был не на немецком. Верни translation только на немецком языке.";

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
            { role: "user", content: `${userPrompt}${retryInstruction}` }
          ],
          reasoning_effort: "medium",
          max_completion_tokens: 3600,
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
      if (!outputText) continue;

      const cleaned = outputText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleaned) as ParsedTranslation;
      if (parsed.translation) {
        parsed.translation = normalizeTranslation(parsed.translation, targetLanguage);
      }
      const validShape = parsed.translation && parsed.kind && Array.isArray(parsed.entries);
      const validTerm = parsed.kind !== "term" || (parsed.entries!.length >= 1 && parsed.entries!.length <= 3);

      if (!validShape || !validTerm || !hasExpectedLanguage(parsed.translation!, targetLanguage)) {
        continue;
      }

      if (parsed.kind === "sentence") {
        parsed.entries = [];
        parsed.explanation = "";
      }

      return json({ ...parsed, sourceLanguage, targetLanguage });
    }

    return json({ error: "Не удалось получить перевод на нужном языке. Повторите запрос." }, 502);
  } catch (error) {
    const message = error instanceof SyntaxError
      ? "Модель вернула некорректный JSON. Повторите запрос."
      : error instanceof Error ? error.message : "Неизвестная ошибка.";
    return json({ error: message }, 500);
  }
}
