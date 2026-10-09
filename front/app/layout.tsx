import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ReduxProvider from "@/redux/provider";
import ToastContainer from "@/components/ui/Toast";
import I18nProvider from "@/components/providers/I18nProvider";
import ThemeProvider from "@/components/providers/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clinical Precision | Clinic Management System",
  description:
    "Production-grade, professional clinical operations and patient management platform.",
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('clinic_theme');
    var theme = stored || 'light';
    var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeInitScript,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-text-primary selection:bg-teal-primary/20 selection:text-teal-primary">
        <ReduxProvider>
          <ThemeProvider>
            <I18nProvider>{children}</I18nProvider>
            <ToastContainer />
          </ThemeProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
