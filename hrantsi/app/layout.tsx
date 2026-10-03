import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HrantSi — AI զրույց, նկար և վիդեո",
  description: "HrantSi՝ հայկական AI հարթակ․ զրուցիր, ստեղծիր ռեալիստիկ նկարներ, խմբագրիր լուսանկարներ և գեներացրու վիդեոներ։",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0f14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hy">
      <body>{children}</body>
    </html>
  );
}
