
# Replay da LLM -- variante "senior-thinking" -- nvidia/nemotron-3-super-120b-a12b

## IN (150 situacoes) -- LONG 28 | SHORT 32 | NONE 45 | erro 45
  operou (lado escolhido)     n=  60  acerto  43.3% [32-56]  E[R] -0.035 [-0.21, 0.14] t=-0.38  soma -2.1R
  mesmas, lado oposto         n=  60  acerto  50.0% [38-62]  E[R] -0.078 [-0.25, 0.09] t=-0.89  soma -4.7R
  LLM AO VIVO, mesmas situac. n= 150  acerto  38.0% [31-46]  E[R] -0.177 [-0.28, -0.08] t=-3.47  soma -26.6R
  aleatorio (media L/S)       n= 150  acerto  28.0% [21-36]  E[R] -0.157 [-0.21, -0.10] t=-5.50  soma -23.6R
  resultado por situacao (NONE=0): soma -2.1R em 150 situacoes = -0.014R/situacao  vs ao vivo -0.177
  por ativo: BTCUSD n12 0.31R | NAS100 n11 -0.26R | SPX500 n13 -0.02R | LNKUSD n2 -1.17R | XETUSD n11 -0.13R | UKOUSD n11 0.10R

## OUT (150 situacoes) -- LONG 22 | SHORT 33 | NONE 63 | erro 32
  operou (lado escolhido)     n=  55  acerto  50.9% [38-64]  E[R] -0.130 [-0.33, 0.07] t=-1.27  soma -7.2R
  mesmas, lado oposto         n=  55  acerto  56.4% [43-69]  E[R] -0.010 [-0.21, 0.19] t=-0.10  soma -0.6R
  LLM AO VIVO, mesmas situac. n= 150  acerto  49.3% [41-57]  E[R] -0.115 [-0.23, 0.00] t=-1.91  soma -17.2R
  aleatorio (media L/S)       n= 150  acerto  38.0% [31-46]  E[R] -0.103 [-0.16, -0.05] t=-3.58  soma -15.4R
  resultado por situacao (NONE=0): soma -7.2R em 150 situacoes = -0.048R/situacao  vs ao vivo -0.115
  por ativo: NAS100 n8 -0.10R | LNKUSD n7 -0.74R | BTCUSD n9 -0.10R | UKOUSD n10 -0.18R | XAGUSD n10 0.23R | SPX500 n8 -0.13R | XETUSD n3 0.09R
