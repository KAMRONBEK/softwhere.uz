import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";

const inter = Inter({subsets: ["latin"]});

export const metadata: Metadata = {
    title:
        "Закажите Веб-Сайт Любой Сложности, Мобильное Приложение Или Телеграм-Бот со Скидкой от 20% до 50% ",
    description:
        "Получите 1 Год Бесплатного Хостинга и Другие Бонусы Для Первых 10 Клиентов.",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body className={inter.className}>
        <Header/>
        {children}

        <ScrollToTop/>
        <Footer/>
        </body>
        </html>
    );
}
