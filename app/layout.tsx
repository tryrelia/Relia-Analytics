import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { ChatLayoutWrapper } from "@/components/chat-layout-wrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relia Analytics",
  description: "AI chat interface for PostHog analytics",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="h-full">
        <Providers>
          <ChatLayoutWrapper>{children}</ChatLayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}
