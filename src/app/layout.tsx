import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Example font
import "./globals.css";

// Initialize font (adjust as needed)
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    icons: {
        icon: [
            {
                url: '/favicon.svg',
                type: 'image/svg+xml',
            },
            {
                url: '/icons/logo.svg',
                type: 'image/svg+xml',
            }
        ],
        shortcut: '/favicon.svg',
        apple: '/icons/logo.svg',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        // The lang attribute will be handled by the [locale] layout
        <html>
            <body className={inter.className}>{children}</body>
        </html>
    );
} 