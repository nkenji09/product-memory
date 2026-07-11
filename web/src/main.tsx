import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import { LookupsProvider } from './lookups'
import { CommentsProvider } from './components/comments/useComments'

render(
  <LookupsProvider>
    <CommentsProvider>
      <App />
    </CommentsProvider>
  </LookupsProvider>,
  document.getElementById('app')!,
)
