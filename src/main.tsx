import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import Footer from './Footer.tsx'

createRoot(document.getElementById('root')!).render(
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <main style={{ flex: '1' }}>
            <App />
        </main>

        <Footer />
    </div>
)
