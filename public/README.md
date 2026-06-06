# Assets públicos

## `login-equipe-gps.jpg` (necessário)

Foto da equipe multisserviços do Grupo GPS usada como **fundo do painel esquerdo da tela de login**
(`app/page.tsx`). Salve a imagem da apresentação comercial neste caminho exato:

```
public/login-equipe-gps.jpg
```

Recomendações:
- Proporção paisagem (~2:1) ou maior; é exibida com `object-cover` no painel esquerdo (~50vw de largura em telas ≥1024px).
- Um overlay escuro (gradiente de baixo p/ cima) é aplicado por cima para manter logo e textos legíveis.
- Para trocar o nome/arquivo, ajuste o `src` do `<Image>` em `app/page.tsx`.
