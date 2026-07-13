"use client";

import { useMemo, useState } from "react";

type Direction = "ru-de" | "de-ru";

const demo = {
  noun: {
    article: "der",
    word: "Tisch",
    plural: "die Tische",
    translation: "стол",
    gender: "maskulin"
  },
  verb: {
    infinitive: "gehen",
    preterite: "ging",
    participle: "ist gegangen",
    translation: "идти, ходить",
    note: "Глагол движения; в Perfekt используется sein."
  },
  phrase: {
    source: "Ich gehe heute früher nach Hause.",
    translation: "Сегодня я иду домой раньше.",
    note: "nach Hause — направление: домой; zu Hause — местоположение: дома."
  }
};

export default function Home() {
  const [direction, setDirection] = useState<Direction>("ru-de");
  const [text, setText] = useState("");

  const labels = useMemo(
    () =>
      direction === "ru-de"
        ? { from: "Русский", to: "Deutsch", placeholder: "Напишите слово или фразу по-русски…" }
        : { from: "Deutsch", to: "Русский", placeholder: "Schreib ein Wort oder einen Satz…" },
    [direction]
  );

  function swapDirection() {
    setDirection((current) => (current === "ru-de" ? "de-ru" : "ru-de"));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Wortkklar, главная">
          Wort<span>k</span>klar
        </a>
        <button className="quietButton" type="button">Сохранённые</button>
      </header>

      <section className="hero">
        <p className="eyebrow">Переводчик, который объясняет</p>
        <h1>Понимай немецкий,<br />а не просто переводи.</h1>
        <p className="intro">
          Перевод, формы слов, род существительных и живые примеры — спокойно и без лишнего шума.
        </p>
      </section>

      <section className="translator" aria-label="Переводчик">
        <div className="languageBar">
          <span>{labels.from}</span>
          <button className="swapButton" type="button" onClick={swapDirection} aria-label="Поменять языки местами">⇄</button>
          <span>{labels.to}</span>
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={labels.placeholder}
          maxLength={1200}
          autoFocus
        />

        <div className="inputFooter">
          <span>{text.length} / 1200</span>
          <button className="primaryButton" type="button" disabled={!text.trim()}>
            Разобрать
          </button>
        </div>
      </section>

      <section className="results" aria-label="Пример разбора">
        <div className="sectionHeading">
          <p>Как будет выглядеть разбор</p>
          <span>Демо</span>
        </div>

        <article className="resultCard nounCard">
          <div className="cardTopline">
            <span className="kind">Существительное</span>
            <button className="saveButton" type="button" aria-label="Сохранить слово">＋</button>
          </div>
          <div className="wordLine">
            <span className="article masculine">{demo.noun.article}</span>
            <strong>{demo.noun.word}</strong>
          </div>
          <p className="translation">{demo.noun.translation}</p>
          <div className="facts">
            <span><small>Род</small>{demo.noun.gender}</span>
            <span><small>Множественное число</small>{demo.noun.plural}</span>
          </div>
        </article>

        <article className="resultCard">
          <div className="cardTopline">
            <span className="kind">Глагол</span>
            <button className="saveButton" type="button" aria-label="Сохранить слово">＋</button>
          </div>
          <strong className="mainWord">{demo.verb.infinitive}</strong>
          <p className="translation">{demo.verb.translation}</p>
          <div className="verbForms">
            <span><small>Infinitiv</small>{demo.verb.infinitive}</span>
            <span><small>Präteritum</small>{demo.verb.preterite}</span>
            <span><small>Partizip II</small>{demo.verb.participle}</span>
          </div>
          <p className="note">{demo.verb.note}</p>
        </article>

        <article className="resultCard phraseCard">
          <div className="cardTopline">
            <span className="kind">Фраза в контексте</span>
          </div>
          <p className="sentence">{demo.phrase.source}</p>
          <p className="translation">{demo.phrase.translation}</p>
          <p className="note">{demo.phrase.note}</p>
        </article>
      </section>

      <footer>
        <span>Wortkklar</span>
        <p>Сделано для тех, кто действительно учит язык.</p>
      </footer>
    </main>
  );
}
