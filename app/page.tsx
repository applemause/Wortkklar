"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";

type Entry = {
  type: "noun" | "verb" | "adjective" | "phrase" | "other";
  word: string;
  translation: string;
  article: "der" | "die" | "das" | null;
  plural: string | null;
  gender: "maskulin" | "feminin" | "neutral" | null;
  infinitive: string | null;
  preterite: string | null;
  participle: string | null;
  auxiliary: "haben" | "sein" | null;
  comparative: string | null;
  superlative: string | null;
  government: string | null;
  note: string | null;
  example: string;
  exampleTranslation: string;
};

type TranslationResult = {
  translation: string;
  explanation: string;
  entries: Entry[];
  sourceLanguage: "ru" | "de";
  targetLanguage: "ru" | "de";
  query: string;
};

const STORAGE_KEY = "wortklar-groq-settings";

export default function Home() {
  const [text, setText] = useState("");
  const [model, setModel] = useState("openai/gpt-oss-20b");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const settings = JSON.parse(saved) as { model?: string };
      setModel(settings.model ?? "openai/gpt-oss-20b");
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  function chooseModel(nextModel: string) {
    setModel(nextModel);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ model: nextModel }));
    setSettingsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function translate(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const submittedText = text.trim();

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: submittedText, model: model.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось выполнить перевод.");
      setResult({ ...data, query: submittedText });
    } catch (requestError) {
      setResult(null);
      setError(requestError instanceof Error ? requestError.message : "Неизвестная ошибка.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <span className="wordmark">Wortklar</span>
        <button className="iconButton" type="button" onClick={() => setSettingsOpen(true)} aria-label="Настройки">
          <SettingsIcon />
        </button>
      </header>

      <div className="workspace">
        <form className="composer" onSubmit={translate}>
          <div className="inputRow">
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                event.target.style.height = "0px";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 240)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Слово или фраза"
              maxLength={1200}
              rows={1}
              autoFocus
            />
            <button className="submitButton" type="submit" disabled={!text.trim() || loading} aria-label="Перевести">
              {loading ? <span className="loader" /> : <ArrowIcon />}
            </button>
          </div>
        </form>

        {error && <p className="errorMessage">{error}</p>}

        {result && (
          <section className="results" aria-live="polite">
            <div className="answer">
              <small className="resultDirection">
                {result.sourceLanguage === "de" ? "Deutsch → Русский" : "Русский → Deutsch"}
              </small>
              <p lang={result.targetLanguage}><AnswerText value={result.translation} /></p>
              {result.explanation && !sameText(result.explanation, result.translation) && (
                <span lang="ru">{result.explanation}</span>
              )}
            </div>

            <div className="entries">
              {result.entries.map((entry, index) => (
                <EntryView
                  entry={entry}
                  answer={result.translation}
                  query={result.query}
                  explanation={result.explanation}
                  showMeaning={result.entries.length > 1}
                  showSeparator={index > 0}
                  key={`${entry.word}-${index}`}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {settingsOpen && (
        <div className="settingsLayer" onMouseDown={() => setSettingsOpen(false)}>
          <section className="settingsPopover" onMouseDown={(event) => event.stopPropagation()} aria-label="Выбор модели">
            <p>Модель</p>
            <button className={model === "openai/gpt-oss-20b" ? "selected" : ""} type="button" onClick={() => chooseModel("openai/gpt-oss-20b")}>
              <span>GPT-OSS 20B</span><small>Быстро</small>
            </button>
            <button className={model === "openai/gpt-oss-120b" ? "selected" : ""} type="button" onClick={() => chooseModel("openai/gpt-oss-120b")}>
              <span>GPT-OSS 120B</span><small>Точнее</small>
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function EntryView({ entry, answer, query, explanation, showMeaning, showSeparator }: {
  entry: Entry;
  answer: string;
  query: string;
  explanation: string;
  showMeaning: boolean;
  showSeparator: boolean;
}) {
  const term = entry.type === "noun" && entry.article ? `${entry.article} ${entry.word}` : entry.word;
  const queryRepeatsTerm = sameText(query, term) || (entry.type !== "noun" && sameText(query, entry.word));
  const showTerm = !containsText(answer, term) && !queryRepeatsTerm;
  const showTranslation = showMeaning && !containsText(answer, entry.translation) && !sameText(query, entry.translation);
  const forms = morphologyForms(entry);
  const showNote = entry.note && !sameText(entry.note, explanation);

  return (
    <article className={`entry${showSeparator ? " separated" : ""}`}>
      <small className="entryKind">{entryTypeLabel(entry.type)}</small>

      {showTerm && (
        <div className="term" lang="de">
          {entry.type === "noun" && entry.article && (
            <span className={`article ${genderClass(entry.article)}`}>{entry.article}</span>
          )}
          <strong>{entry.word}</strong>
        </div>
      )}

      {showTranslation && <p className="entryTranslation" lang="ru">{entry.translation}</p>}

      {forms.length > 0 && (
        <dl className="morphology">
          {forms.map((form) => (
            <div key={`${form.label}-${form.value}`}>
              <dt>{form.label}</dt>
              <dd lang="de">{form.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {entry.government && (
        <div className="annotation">
          <small>Управление</small>
          <p lang="de">{entry.government}</p>
        </div>
      )}

      {showNote && (
        <div className="annotation">
          <small>Грамматика</small>
          <p lang="ru">{entry.note}</p>
        </div>
      )}

      {(entry.example || entry.exampleTranslation) && (
        <div className="example">
          <small>Пример</small>
          {entry.example && <p lang="de">{entry.example}</p>}
          {entry.exampleTranslation && !sameText(entry.example, entry.exampleTranslation) && <span lang="ru">{entry.exampleTranslation}</span>}
        </div>
      )}
    </article>
  );
}

function morphologyForms(entry: Entry) {
  if (entry.type === "noun") {
    return entry.plural ? [{ label: "Множественное", value: entry.plural }] : [];
  }

  if (entry.type === "verb") {
    return [
      { label: "Infinitiv", value: entry.infinitive ?? entry.word },
      entry.preterite ? { label: "Präteritum", value: entry.preterite } : null,
      entry.participle ? {
        label: "Perfekt",
        value: `${entry.auxiliary === "sein" ? "ist" : "hat"} ${entry.participle}`
      } : null
    ].filter((item): item is { label: string; value: string } => Boolean(item));
  }

  if (entry.type === "adjective") {
    return [
      entry.comparative ? { label: "Komparativ", value: entry.comparative } : null,
      entry.superlative ? { label: "Superlativ", value: entry.superlative } : null
    ].filter((item): item is { label: string; value: string } => Boolean(item));
  }

  return [];
}

function cleanText(value: string | null | undefined) {
  return (value ?? "").toLocaleLowerCase("de-DE").replace(/[.,!?;:()[\]{}„“\"'’]/g, "").replace(/\s+/g, " ").trim();
}

function sameText(first: string | null | undefined, second: string | null | undefined) {
  const a = cleanText(first);
  const b = cleanText(second);
  return Boolean(a && b && a === b);
}

function containsText(container: string | null | undefined, value: string | null | undefined) {
  const a = cleanText(container);
  const b = cleanText(value);
  return Boolean(a && b && (a === b || a.includes(b)));
}

function genderClass(article: "der" | "die" | "das") {
  return article === "der" ? "masculine" : article === "die" ? "feminine" : "neutral";
}

function entryTypeLabel(type: Entry["type"]) {
  return {
    noun: "Существительное",
    verb: "Глагол",
    adjective: "Прилагательное",
    phrase: "Выражение",
    other: "Разбор"
  }[type];
}

function AnswerText({ value }: { value: string }) {
  const match = value.match(/^(der|die|das)\s+(.+)$/i);
  if (!match) return value;

  const article = match[1].toLocaleLowerCase("de-DE") as "der" | "die" | "das";
  return <><span className={`answerArticle ${genderClass(article)}`}>{match[1]}</span> {match[2]}</>;
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2.75v2.1M12 19.15v2.1M21.25 12h-2.1M4.85 12h-2.1M18.54 5.46l-1.49 1.49M6.95 17.05l-1.49 1.49M18.54 18.54l-1.49-1.49M6.95 6.95 5.46 5.46" /></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5" /></svg>;
}
