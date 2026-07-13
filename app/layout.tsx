import type { Metadata } from "next";
import "./globals.css";
import "./settings.css";

export const metadata: Metadata = {
  title: "Wortklar — умный немецко-русский переводчик",
  description: "Переводчик для изучения немецкого с грамматикой, формами слов и живыми примерами."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
