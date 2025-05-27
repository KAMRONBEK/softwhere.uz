import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Example font
import "./globals.css";

// Initialize font (adjust as needed)
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "My Awesome Blog", // Replace with your site title
    description: "Generated blog posts about web and mobile dev", // Replace with your description
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