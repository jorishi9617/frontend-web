import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Platform",
  description: "Secure one-to-one video calling",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
