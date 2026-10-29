import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
})

export const metadata: Metadata = {
  title: "澜姿 · 姿势参考生图",
  description: "从中文姿势图库里选择一个或多个姿势，用社区鲸鱼娘大飞鱼的成年形象或你导入的模特生成图片。DeepSeek Harness 插件。",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${outfit.variable} antialiased`}>{children}</body>
    </html>
  )
}
