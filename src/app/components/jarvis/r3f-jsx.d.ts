// O repo resolve @types/react@19 (via MUI/Radix, transitivo — não pinado em
// package.json), mas o app roda React 18.3.1. React 19 mudou onde o
// namespace JSX vive (React.JSX em vez de global JSX), então a augmentation
// `declare global { namespace JSX {...} }` do @react-three/fiber v8 não é
// enxergada pelo compilador aqui. Sem isso, todo elemento intrínseco do R3F
// (<ambientLight>, <pointLight>, etc.) falha o type-check mesmo funcionando
// em runtime. Fix local, escopado só a este módulo — não mexe na resolução
// de @types/react do resto do projeto.
import type { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
