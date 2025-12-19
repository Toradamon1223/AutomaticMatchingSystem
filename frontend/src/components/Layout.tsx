import { ReactNode } from 'react'
import Header from './Header'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div style={{ width: '100%', minHeight: '100vh' }}>
      <Header />
      <div style={{ padding: '0 20px', maxWidth: '1400px', margin: '0 auto' }}>{children}</div>
    </div>
  )
}

