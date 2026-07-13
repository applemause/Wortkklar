type PagesContext = {
  request: Request;
};

const systemPrompt = `Ты — точный русско-немецкий учебный переводчик.
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
      "note": "краткая грамматическая или стилистическая заметка или null",
      "example": "естественный пример на немецком",
      "exampleTranslation": "перевод примера на русский"
    }
  ]
}
Правила:
- При переводе с русского на немецкий всегда разбирай ключевые немецкие слова результата.
- Для существительных обязательно указывай артикль и множественное число.
- Для глаголов обязательно указывай Infinitiv, Präteritum, Partizip II и haben/sein.
- Для отделяемых, возвратных глаголов и управления показывай полную словарную форму.
- Не придумывай редкие значения без необходимости.
- Пояснение должно быть коротким и понятным ученику A2-B1.
- JSON должен быть валидным.`;

const modelAliases: Record<string, string> = {
  "gpt-5.6-luna": "gpt-5-mini",
  "gpt-5.6-terra": "gpt-5.2",
  "gpt-5.6": "gpt-5.2"
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    const body = await context.request.json() as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const direction = body.direction === "de-ru" ? "de-ru" : "ru-de";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const requestedModel = typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : "gpt-5.2";
    const model = modelAliases[requestedModel] ?? requestedModel;

    if (!text) return json({ error: "Введите текст для перевода." }, 400);
    if (!apiKey) return json({ error: "Не указан API-ключ." }, 400);

    const userPrompt = direction === "ru-de"
      ? `Переведи с русского на немецкий и сделай учебный разбор: ${text}`
      : `Переведи с немецкого на русский и сделай учебный разбор немецких слов: ${text}`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: userPrompt,
        max_output_tokens: 2200
      })
    });

    const payload = await response.json() as {
      error?: { message?: string };
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };

    if (!response.ok) {
      return json({ error: payload.error?.message || "OpenAI API вернул ошибку." }, response.status);
    }

    const outputText = payload.output_text ?? payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text;

    if (!outputText) return json({ error: "Модель не вернула текстовый ответ." }, 502);

    const cleaned = outputText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { translation?: string; entries?: unknown[] };

    if (!parsed.translation || !Array.isArray(parsed.entries)) {
      return json({ error: "Ответ модели имеет неверный формат." }, 502);
    }

    return json(parsed);
  } catch (error) {
    const message = error instanceof SyntaxError
      ? "Модель вернула некорректный JSON. Повторите запрос."
      : error instanceof Error ? error.message : "Неизвестная ошибка.";
    return json({ error: message }, 500);
  }
}
