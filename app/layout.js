import './globals.css'

export const metadata = {
  title: 'Track Timing System',
  description: 'Real-time track and field timing system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="bg-black">
      <body>{children}</body>
    </html>
  )
}
