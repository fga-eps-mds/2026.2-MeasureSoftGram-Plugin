import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import '@vscode/codicons/dist/codicon.css'
import './index.css'
import App from './App.tsx'
import {configureInitialL10n} from './utils/l10nBundle'

configureInitialL10n()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App/>
    </StrictMode>,
)
