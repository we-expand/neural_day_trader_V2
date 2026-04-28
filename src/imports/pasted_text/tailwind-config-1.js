Last login: Tue Apr 21 01:50:33 on ttys000
clebercouto@MacBook-Pro-de-Cleber ~ % find ~/ -name "Neural-Day-Trader" -type d 2>/dev/null
/Users/clebercouto/Projects/we-expand/Neural-Day-Trader
# Criar/sobrescrever src/index.css com as correções
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  margin: 0;
  padding: 0;
  background: #000;
  color: #fff;
  min-height: 100vh;
}

img, svg, video, canvas {
  max-width: 100%;
  height: auto;
}
EOF

# Instalar dependências (garante Tailwind)
npm install -D tailwindcss postcss autoprefixer

# Criar tailwind.config.js
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

# Criar postcss.config.js
cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Validar build
npm run build

# Git add, commit, push
git add .
git commit -m "fix: habilita Tailwind, remove reset tóxico 100vh/100vw, corrige layout"
git push origi
clebercouto@MacBook-Pro-de-Cleber ~ % # Criar/sobrescrever src/index.css com as correções
zsh: command not found: #
clebercouto@MacBook-Pro-de-Cleber ~ % cat > src/index.css << 'EOF'
heredoc> @tailwind base;
heredoc> @tailwind components;
heredoc> @tailwind utilities;
heredoc> 
heredoc> html, body, #root {
heredoc>   margin: 0;
heredoc>   padding: 0;
heredoc>   background: #000;
heredoc>   color: #fff;
heredoc>   min-height: 100vh;
heredoc> }
heredoc> 
heredoc> img, svg, video, canvas {
heredoc>   max-width: 100%;
heredoc>   height: auto;
heredoc> }
heredoc> EOF
zsh: no such file or directory: src/index.css
clebercouto@MacBook-Pro-de-Cleber ~ % 
clebercouto@MacBook-Pro-de-Cleber ~ % # Instalar dependências (garante Tailwind)
zsh: unknown group
clebercouto@MacBook-Pro-de-Cleber ~ % npm install -D tailwindcss postcss autoprefixer

# Criar tailwind.config.js
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

# Criar postcss.config.js
cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Validar build
npm run build

# Git add, commit, push
git add .
git commit -m "fix: habilita Tailwind, remove reset tóxico 100vh/100vw, corrige layout"
git push origin principal

echo "✅ Deploy enviado para Vercel!"

added 13 packages, and audited 199 packages in 1s

21 packages are looking for funding
  run `npm fund` for details

1 high severity vulnerability

To address all issues, run:
  npm audit fix

Run `npm audit` for details.
clebercouto@MacBook-Pro-de-Cleber ~ % 
clebercouto@MacBook-Pro-de-Cleber ~ % # Criar tailwind.config.js
zsh: command not found: #
clebercouto@MacBook-Pro-de-Cleber ~ % cat > tailwind.config.js << 'EOF'
heredoc> /** @type {import('tailwindcss').Config} */
heredoc> export default {
heredoc>   content: [
heredoc>     "./index.html",
heredoc>     "./src/**/*.{js,jsx,ts,tsx}",
heredoc>   ],
heredoc>   theme: {
heredoc>     extend: {},
heredoc>   },
heredoc>   plugins: [],
heredoc> }
heredoc> EOF
clebercouto@MacBook-Pro-de-Cleber ~ % 
clebercouto@MacBook-Pro-de-Cleber ~ % # Criar postcss.config.js
zsh: command not found: #
clebercouto@MacBook-Pro-de-Cleber ~ % cat > postcss.config.js << 'EOF'
heredoc> export default {
heredoc>   plugins: {
heredoc>     tailwindcss: {},
heredoc>     autoprefixer: {},
heredoc>   },
heredoc> }
heredoc> EOF
clebercouto@MacBook-Pro-de-Cleber ~ % 
clebercouto@MacBook-Pro-de-Cleber ~ % # Validar build
zsh: command not found: #
clebercouto@MacBook-Pro-de-Cleber ~ % npm run build

# Git add, commit, push
git add .
git commit -m "fix: habilita Tailwind, remove reset tóxico 100vh/100vw, corrige layout"
git push origin principal

echo "✅ Deploy enviado para Vercel!"
npm error Missing script: "build"
npm error
npm error To see a list of scripts, run:
npm error   npm run
npm error A complete log of this run can be found in: /Users/clebercouto/.npm/_logs/2026-04-21T05_01_25_321Z-debug-0.log
clebercouto@MacBook-Pro-de-Cleber ~ % 
clebercouto@MacBook-Pro-de-Cleber ~ % # Git add, commit, push
zsh: command not found: #
clebercouto@MacBook-Pro-de-Cleber ~ % git add .
fatal: not a git repository (or any of the parent directories): .git
clebercouto@MacBook-Pro-de-Cleber ~ % git commit -m "fix: habilita Tailwind, remove reset tóxico 100vh/100vw, corrige layout"
fatal: not a git repository (or any of the parent directories): .git
clebercouto@MacBook-Pro-de-Cleber ~ % git push origin principal
fatal: not a git repository (or any of the parent directories): .git
clebercouto@MacBook-Pro-de-Cleber ~ % 
clebercouto@MacBook-Pro-de-Cleber ~ % echo "✅ Deploy enviado para Vercel!"
dquote> 
clebercouto@MacBook-Pro-de-Cleber ~ % rm -f ~/src/index.css ~/tailwind.config.js ~/postcss.config.js
clebercouto@MacBook-Pro-de-Cleber ~ % cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % pwd
/Users/clebercouto/Projects/we-expand/Neural-Day-Trader
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % ls -la | grep package.json
-rw-r--r--    1 clebercouto  staff    3311 21 abr 00:42 package.json
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  margin: 0;
  padding: 0;
  background: #000;
  color: #fff;
  min-height: 100vh;
}

img, svg, video, canvas {
  max-width: 100%;
  height: auto;
}
EOF
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % npm install -D tailwindcss postcss autoprefixer
npm warn idealTree Removing dependencies.tailwindcss in favor of devDependencies.tailwindcss

added 6 packages, changed 1 package, and audited 622 packages in 2s

132 packages are looking for funding
  run `npm fund` for details

17 vulnerabilities (6 low, 3 moderate, 6 high, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.

Run `npm audit` for details.
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % git add .
git commit -m "fix: habilita Tailwind, remove reset tóxico 100vh/100vw, corrige layout"
git push origin principal
[main c7470a0d] fix: habilita Tailwind, remove reset tóxico 100vh/100vw, corrige layout
 17 files changed, 10317 insertions(+), 3 deletions(-)
 create mode 100644 dist/assets/BinanceWebSocketManager-BrA_o8DV.js
 create mode 100644 dist/assets/DevLab-BNo_YAYQ.js
 create mode 100644 dist/assets/LiquidityDetector-CInSeCnu.js
 create mode 100644 dist/assets/index-BIBEhZ8y.js
 create mode 100644 dist/assets/index-kqu5GxLr.js
 create mode 100644 dist/assets/style-hmT4gzaR.css
 create mode 100644 dist/assets/vixDataSources-Twea1Za9.js
 create mode 100644 dist/favicon.svg
 create mode 100644 dist/icon.svg
 create mode 100644 dist/index.html
 create mode 100644 dist/logo.svg
 create mode 100644 dist/proposta-comercial.html
 create mode 100644 package-lock.json
 create mode 100644 postcss.config.js
 create mode 100644 src/index.css
 create mode 100644 tailwind.config.js
error: src refspec principal does not match any
error: failed to push some refs to 'https://github.com/we-expand/Neural-Day-Trader.git'
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % git push origin main:principal
Enumerating objects: 25, done.
Counting objects: 100% (25/25), done.
Delta compression using up to 12 threads
Compressing objects: 100% (21/21), done.
Writing objects: 100% (22/22), 1.20 MiB | 3.46 MiB/s, done.
Total 22 (delta 4), reused 4 (delta 1), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (4/4), completed with 3 local objects.
To https://github.com/we-expand/Neural-Day-Trader.git
   e8c85ba8..c7470a0d  main -> principal
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader && rm -f src/index.css tailwind.config.js postcss.config.js && cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
html,body,#root{margin:0;padding:0;background:#000;color:#fff;min-height:100vh}img,svg,video,canvas{max-width:100%;height:auto}
EOF
cat > tailwind.config.js << 'EOF'
export default {content:["./index.html","./src/**/*.{js,jsx,ts,tsx}"],theme:{extend:{}},plugins:[]}
EOF
cat > postcss.config.js << 'EOF'
export default {plugins:{tailwindcss:{},autoprefixer:{}}}
EOF
npm install -D tailwindcss@latest postcss@latest autoprefixer@latest && git add . && git commit -m "fix: corrige Tailwind e reset CSS" && git push origin main:principal

changed 1 package, and audited 622 packages in 2s

132 packages are looking for funding
  run `npm fund` for details

17 vulnerabilities (6 low, 3 moderate, 6 high, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.

Run `npm audit` for details.
[main 625c8b1d] fix: corrige Tailwind e reset CSS
 5 files changed, 8 insertions(+), 35 deletions(-)
Enumerating objects: 15, done.
Counting objects: 100% (15/15), done.
Delta compression using up to 12 threads
Compressing objects: 100% (8/8), done.
Writing objects: 100% (8/8), 991 bytes | 991.00 KiB/s, done.
Total 8 (delta 4), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (4/4), completed with 4 local objects.
To https://github.com/we-expand/Neural-Day-Trader.git
   c7470a0d..625c8b1d  main -> principal
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader && npm install -D @tailwindcss/postcss && cat > postcss.config.js << 'EOF'
export default {plugins:{"@tailwindcss/postcss":{}}}
EOF
git add . && git commit -m "fix: usa novo @tailwindcss/postcss para Tailwind v6" && git push origin main:principal

added 7 packages, and audited 629 packages in 2s

135 packages are looking for funding
  run `npm fund` for details

17 vulnerabilities (6 low, 3 moderate, 6 high, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.

Run `npm audit` for details.
[main dc1c7931] fix: usa novo @tailwindcss/postcss para Tailwind v6
 3 files changed, 548 insertions(+), 1 deletion(-)
Enumerating objects: 9, done.
Counting objects: 100% (9/9), done.
Delta compression using up to 12 threads
Compressing objects: 100% (5/5), done.
Writing objects: 100% (5/5), 3.81 KiB | 1.91 MiB/s, done.
Total 5 (delta 3), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (3/3), completed with 3 local objects.
To https://github.com/we-expand/Neural-Day-Trader.git
   625c8b1d..dc1c7931  main -> principal
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
cat src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;
html,body,#root{margin:0;padding:0;background:#000;color:#fff;min-height:100vh}img,svg,video,canvas{max-width:100%;height:auto}
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
cat src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;
html,body,#root{margin:0;padding:0;background:#000;color:#fff;min-height:100vh}img,svg,video,canvas{max-width:100%;height:auto}
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
git checkout main
git merge principal
git push origin main
Already on 'main'
Your branch is ahead of 'origin/main' by 3 commits.
  (use "git push" to publish your local commits)
merge: principal - not something we can merge

Did you mean this?
	origin/principal
Total 0 (delta 0), reused 0 (delta 0), pack-reused 0 (from 0)
To https://github.com/we-expand/Neural-Day-Trader.git
   c5a5acf2..dc1c7931  main -> main
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % cat package.json | grep -A5 "build"
    "build": "vite build",
    "analyze": "./node_modules/.bin/vite build --mode analyze",
    "clear-cache": "rm -rf node_modules/.vite && rm -rf .vite && rm -rf dist && echo '✅ Cache limpo! Execute: npm run dev'",
    "dev": "vite"
  },
  "dependencies": {
    "@emotion/react": "11.14.0",
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % bash

The default interactive shell is now zsh.
To update your account to use zsh, please run `chsh -s /bin/zsh`.
For more details, please visit https://support.apple.com/kb/HT208050.
bash-3.2$ cat src/main.tsx
console.log('🚀 Neural Day Trader Initializing...');
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './styles/theme.css'

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
bash-3.2$ exit
exit
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
cat > src/styles/theme.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

html,body,#root{margin:0;padding:0;background:#000;color:#fff;min-height:100vh}img,svg,video,canvas{max-width:100%;height:auto}
EOF
git add . && git commit -m "fix: atualiza theme.css com Tailwind correto" && git push origin main
[main fcc61072] fix: atualiza theme.css com Tailwind correto
 1 file changed, 4 insertions(+), 665 deletions(-)
Enumerating objects: 9, done.
Counting objects: 100% (9/9), done.
Delta compression using up to 12 threads
Compressing objects: 100% (5/5), done.
Writing objects: 100% (5/5), 545 bytes | 545.00 KiB/s, done.
Total 5 (delta 3), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (3/3), completed with 3 local objects.
To https://github.com/we-expand/Neural-Day-Trader.git
   dc1c7931..fcc61072  main -> main
clebercouto@MacBook-Pro-de-Cleber Neural-Day-Trader % cd
clebercouto@MacBook-Pro-de-Cleber ~ % pwd
/Users/clebercouto
clebercouto@MacBook-Pro-de-Cleber ~ % cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2
clebercouto@MacBook-Pro-de-Cleber Neural_Day_Trader_V2 % ls
AI_TRADER_MODULE_SUMMARY.md		DIAGNOSTIC.md				INDICE_IFRAME_FIX.md			README_QUICK_START.md			STRATEGY_BUILDER_PRO.md
api					ESTA_PRONTO.md				INDICE_SIMPLES.md			README.md				supabase
ATTRIBUTIONS.md				FACA_AGORA.md				LEIA-ME-PRIMEIRO.md			REALIDADE_IFRAME_ERROR.md		SUPABASE_COMPLETE_GUIDE.md
AUDITORIA_MOCK_VS_REAL.md		FIGMA_ERROR_EXPLANATION.md		LIQUIDITY_PREDICTION_CHANGES.md		REALTIME_OPTIMIZATION_GUIDE.md		SUPABASE_RE_ENABLED.md
AUTO_SYNC_LOCAL_ACCOUNTS.md		FIGMA_IFRAME_ERROR_FIXED.md		LIQUIDITY_PREDICTION_PATCH_GUIDE.md	RECOVERY_CHALLENGE_GUIDE.md		supabase-migrations
BUGFIX_INFINITE_LOOP.md			FIX_BACKTEST_STORE_ERROR.md		LIVE_TRADING_TEST_GUIDE.md		RESUMO_AI_PERSISTENCE.md		supabase-tests
BUGFIX_LAZY_LOADING.md			fix_corrupted.py			LOGIN_FIXED.md				RESUMO_COMPLETO_CORRECOES.md		SYNTAX_FIX.md
BUGFIX_LOGIN_ERROR_402.md		FIX_FINAL_MT5_IFRAME.md			MARKET_DATA_ARCHITECTURE.md		RESUMO_DECISAO_IFRAME.md		TESTE_3_PASSOS.md
BUILD_FIX.md				FIX_RACE_CONDITION_AI_TRADER.md		MODO_NUCLEAR_v5.md			RESUMO_FINAL.md				TESTE_IFRAME_FIX.md
CHANGELOG.md				FIX_SUMMARY.md				MT5_VALIDATOR_FIX_SUMMARY.md		RESUMO_IFRAME_FIX.md			TESTE_PROTECAO_MAXIMA.md
CHECKLIST_AI_DEMO.md			fix-aitrader.sh				MT5_VALIDATOR_FIX.md			RESUMO_MOCK_VS_REAL.md			TESTE_RAPIDO.md
CHECKLIST_TESTES_AI_PERSISTENCE.md	fix-cache-error.sh			MT5_VALIDATOR_IFRAME_PROTECTION.md	RESUMO_VISUAL_CORRECOES.md		tmp
clear-cache.sh				FORCE_REBUILD.txt			NEURAL_DAY_TRADER_COMPLETE_BLUEPRINT.md	RESUMO_VISUAL.md			TOASTS_ESCUROS_FIX.md
COMANDOS_SQL_PRONTOS.md			GIT_COMMANDS.md				ONDE_ENCONTRAR_TESTES.md		ROADMAP_AI_TRADING_DEMO.md		TRADING_EXECUTION_GUIDE.md
COMO_TESTAR.md				GUIA_IMPLEMENTACAO_AI_PERSISTENCE.md	OPTIMIZATION_GUIDE.md			ROADMAP_SIMULADOR.md			tsconfig.json
CONEXAO_MT5_AITRADER.md			GUIA_SEGUIR_EM_FRENTE.md		OPTIMIZATION.md				scripts					URLSEARCHPARAMS_FIX_FINAL.md
CORRECAO_AI_TRADER_VOICE_MENU.md	guidelines				package.json				SIMULADOR_IMPLEMENTADO.md		utils
CORRECAO_FAILED_FETCH_APLICADA.md	IFRAME_ERROR_FINAL_FIX.md		PLANO_LIVE_23H.md			SOLUCAO_ERRO_AI_TRADER.md		VERCEL_DEPLOY_GUIDE.md
CORRECAO_IFRAME_ERROR.md		IFRAME_ERROR_MAXIMUM_PROTECTION.md	pnpm-workspace.yaml			SOLUCAO_ERRO_FIGMA_UI.md		vercel.json
CRITICAL_UI_RULES.md			IFRAME_ERROR_PROTECTION.md		postcss.config.mjs			SOLUCAO_ERRO_MAC_PROVIDER.md		VERDADE_IFRAME_ERROR.md
DEBUG_COMANDOS.md			IFRAME_FIX_COMPLETE.md			PROTECAO_EXPERIMENTAL.md		SOLUCAO_FAILED_FETCH.md			vite.config.optimization.ts
DEBUG_LOGIN.md				IFRAME_FIX_SUMMARY.md			PROTECAO_IFRAME_RESUMO.md		SOLUCAO_FINAL_v9.md			vite.config.ts
DECISAO_FINAL_IFRAME_ERROR.md		IMPLEMENTATION_STATUS.md		PROTECAO_ULTRA_AGRESSIVA_v4.md		SOLUCAO_RAPIDA_ERRO_CACHE.md		WEBSOCKET_SEND_FIX.md
default_shadcn_theme.css		IMPLEMENTATION_SUMMARY.md		public					SOLUCAO_RAPIDA_ERRO.md			WEBWORKER_5MS_ANALYSIS.md
DEPLOY_EDGE_FUNCTIONS.md		index.html				QUICK_FIX.md				SOLUCAO_v10_MODO_EXTREMO.md
DEPLOYMENT_CHECKLIST.md			INDICE_DOCUMENTACAO.md			QUOTA_OPTIMIZATION.md			src
clebercouto@MacBook-Pro-de-Cleber Neural_Day_Trader_V2 % npm install
npm warn deprecated deep-diff@1.0.2: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.
npm warn deprecated popper.js@1.16.1: You can find the new Popper v2 at @popperjs/core, this package is dedicated to the legacy v1

added 609 packages, and audited 610 packages in 30s

131 packages are looking for funding
  run `npm fund` for details

17 vulnerabilities (6 low, 3 moderate, 6 high, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.

Run `npm audit` for details.
clebercouto@MacBook-Pro-de-Cleber Neural_Day_Trader_V2 % npm run dev

> @figma/my-make-file@0.0.1 dev
> vite


  VITE v6.3.5  ready in 1080 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
Error:   Failed to scan for dependencies from entries:
  /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/index.html
/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/public/proposta-comercial.html

  ✘ [ERROR] Missing "./root" specifier in "react-dom" package [plugin vite:dep-scan]

    src/main.tsx:2:21:
      2 │ import ReactDOM from 'react-dom/root';
        ╵                      ~~~~~~~~~~~~~~~~

  This error came from the "onResolve" callback registered here:

    node_modules/esbuild/lib/main.js:1141:20:
      1141 │       let promise = setup({
           ╵                     ^

    at setup (file:///Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/node_modules/vite/dist/node/chunks/dep-DBxKXgDP.js:14478:13)
    at handlePlugins (/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/node_modules/esbuild/lib/main.js:1141:21)


    at failureErrorWithLog (/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/node_modules/esbuild/lib/main.js:1467:15)
    at /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/node_modules/esbuild/lib/main.js:926:25
    at runOnEndCallbacks (/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/node_modules/esbuild/lib/main.js:1307:45)
    at buildResponseToResult (/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/node_modules/esbuild/lib/main.js:924:7)
    at /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/node_modules/esbuild/lib/main.js:936:9
    at new Promise (<anonymous>)
    at requestCallbacks.on-end (/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/node_modules/esbuild/lib/main.js:935:54)
    at handleRequest (/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/node_modules/esbuild/lib/main.js:628:17)
    at handleIncomingPacket (/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/node_modules/esbuild/lib/main.js:653:7)
    at Socket.readFromStdout (/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2/node_modules/esbuild/lib/main.js:581:7)
^C
clebercouto@MacBook-Pro-de-Cleber Neural_Day_Trader_V2 % cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2
clebercouto@MacBook-Pro-de-Cleber Neural_Day_Trader_V2 % ls
AI_TRADER_MODULE_SUMMARY.md		DIAGNOSTIC.md				INDICE_IFRAME_FIX.md			QUICK_FIX.md				SOLUCAO_v10_MODO_EXTREMO.md
api					ESTA_PRONTO.md				INDICE_SIMPLES.md			QUOTA_OPTIMIZATION.md			src
ATTRIBUTIONS.md				FACA_AGORA.md				LEIA-ME-PRIMEIRO.md			README_QUICK_START.md			STRATEGY_BUILDER_PRO.md
AUDITORIA_MOCK_VS_REAL.md		FIGMA_ERROR_EXPLANATION.md		LIQUIDITY_PREDICTION_CHANGES.md		README.md				supabase
AUTO_SYNC_LOCAL_ACCOUNTS.md		FIGMA_IFRAME_ERROR_FIXED.md		LIQUIDITY_PREDICTION_PATCH_GUIDE.md	REALIDADE_IFRAME_ERROR.md		SUPABASE_COMPLETE_GUIDE.md
BUGFIX_INFINITE_LOOP.md			FIX_BACKTEST_STORE_ERROR.md		LIVE_TRADING_TEST_GUIDE.md		REALTIME_OPTIMIZATION_GUIDE.md		SUPABASE_RE_ENABLED.md
BUGFIX_LAZY_LOADING.md			fix_corrupted.py			LOGIN_FIXED.md				RECOVERY_CHALLENGE_GUIDE.md		supabase-migrations
BUGFIX_LOGIN_ERROR_402.md		FIX_FINAL_MT5_IFRAME.md			MARKET_DATA_ARCHITECTURE.md		RESUMO_AI_PERSISTENCE.md		supabase-tests
BUILD_FIX.md				FIX_RACE_CONDITION_AI_TRADER.md		MODO_NUCLEAR_v5.md			RESUMO_COMPLETO_CORRECOES.md		SYNTAX_FIX.md
CHANGELOG.md				FIX_SUMMARY.md				MT5_VALIDATOR_FIX_SUMMARY.md		RESUMO_DECISAO_IFRAME.md		TESTE_3_PASSOS.md
CHECKLIST_AI_DEMO.md			fix-aitrader.sh				MT5_VALIDATOR_FIX.md			RESUMO_FINAL.md				TESTE_IFRAME_FIX.md
CHECKLIST_TESTES_AI_PERSISTENCE.md	fix-cache-error.sh			MT5_VALIDATOR_IFRAME_PROTECTION.md	RESUMO_IFRAME_FIX.md			TESTE_PROTECAO_MAXIMA.md
clear-cache.sh				FORCE_REBUILD.txt			NEURAL_DAY_TRADER_COMPLETE_BLUEPRINT.md	RESUMO_MOCK_VS_REAL.md			TESTE_RAPIDO.md
COMANDOS_SQL_PRONTOS.md			GIT_COMMANDS.md				node_modules				RESUMO_VISUAL_CORRECOES.md		tmp
COMO_TESTAR.md				GUIA_IMPLEMENTACAO_AI_PERSISTENCE.md	ONDE_ENCONTRAR_TESTES.md		RESUMO_VISUAL.md			TOASTS_ESCUROS_FIX.md
CONEXAO_MT5_AITRADER.md			GUIA_SEGUIR_EM_FRENTE.md		OPTIMIZATION_GUIDE.md			ROADMAP_AI_TRADING_DEMO.md		TRADING_EXECUTION_GUIDE.md
CORRECAO_AI_TRADER_VOICE_MENU.md	guidelines				OPTIMIZATION.md				ROADMAP_SIMULADOR.md			tsconfig.json
CORRECAO_FAILED_FETCH_APLICADA.md	IFRAME_ERROR_FINAL_FIX.md		package-lock.json			scripts					URLSEARCHPARAMS_FIX_FINAL.md
CORRECAO_IFRAME_ERROR.md		IFRAME_ERROR_MAXIMUM_PROTECTION.md	package.json				SIMULADOR_IMPLEMENTADO.md		utils
CRITICAL_UI_RULES.md			IFRAME_ERROR_PROTECTION.md		PLANO_LIVE_23H.md			SOLUCAO_ERRO_AI_TRADER.md		VERCEL_DEPLOY_GUIDE.md
DEBUG_COMANDOS.md			IFRAME_FIX_COMPLETE.md			pnpm-workspace.yaml			SOLUCAO_ERRO_FIGMA_UI.md		vercel.json
DEBUG_LOGIN.md				IFRAME_FIX_SUMMARY.md			postcss.config.mjs			SOLUCAO_ERRO_MAC_PROVIDER.md		VERDADE_IFRAME_ERROR.md
DECISAO_FINAL_IFRAME_ERROR.md		IMPLEMENTATION_STATUS.md		PROTECAO_EXPERIMENTAL.md		SOLUCAO_FAILED_FETCH.md			vite.config.optimization.ts
default_shadcn_theme.css		IMPLEMENTATION_SUMMARY.md		PROTECAO_IFRAME_RESUMO.md		SOLUCAO_FINAL_v9.md			vite.config.ts
DEPLOY_EDGE_FUNCTIONS.md		index.html				PROTECAO_ULTRA_AGRESSIVA_v4.md		SOLUCAO_RAPIDA_ERRO_CACHE.md		WEBSOCKET_SEND_FIX.md
DEPLOYMENT_CHECKLIST.md			INDICE_DOCUMENTACAO.md			public					SOLUCAO_RAPIDA_ERRO.md			WEBWORKER_5MS_ANALYSIS.md
clebercouto@MacBook-Pro-de-Cleber Neural_Day_Trader_V2 % 


















