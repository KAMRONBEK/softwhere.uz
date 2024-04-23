import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ScrollToTop from "@/components/ScrollToTop";
import type {Metadata} from "next";
import {NextIntlClientProvider, useMessages} from "next-intl";
import {Inter} from "next/font/google";
import React from "react";
import "./globals.css";

const inter = Inter({subsets: ["latin"]});

export const metadata: Metadata = {
  title:
    "Закажите Веб-Сайт Любой Сложности, Мобильное Приложение Или Телеграм-Бот со Скидкой от 20% до 50% ",
  description:
    "Получите 1 Год Бесплатного Хостинга и Другие Бонусы Для Первых 10 Клиентов.",
};

type Props = {
  children: React.ReactNode;
  params: {
    locale: "uz" | "ru";
  };
};

const RootLayout: React.FC<Props> = ({children, params: {locale}}) => {
  const messages = useMessages();
  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <Header />
          {children}
          <ScrollToTop />
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;
