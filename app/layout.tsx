import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wortkklar — умный немецко-русский переводчик",
  description: "Переводчик для изучения немецкого с грамматикой, формами слов и живыми примерами."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
