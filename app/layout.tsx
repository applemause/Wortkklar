import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wortklar — умный немецко-русский переводчик",
  description: "Переводчик для изучения немецкого с грамматикой, формами слов и живыми примерами.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "Wortklar",
    statusBarStyle: "default"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
