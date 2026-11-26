import type { Metadata } from "next"
import localFont from "next/font/local"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const outfit = localFont({
  src: "../node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-outfit",
  display: "swap",
})

export const metadata: Metadata = {
  title: "澜姿 · 姿势参考生图",
  description: "从中文姿势图库里选择姿势，也可以换成衣装集里的衣服，用社区鲸鱼娘大肥鱼的成年形象或你导入的模特生成图片。",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${outfit.variable} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
