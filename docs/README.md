# Demonstração no GitHub Pages

Esta pasta contém a versão menor do site demonstrativo pronta para servir como uma página estática. `index.html` inclui o código e os estilos e funciona no caminho `/Barbearia/`. Fotografias e fontes são carregadas das URLs públicas deste repositório e precisam de internet. A agenda demonstrativa funciona localmente, sem a API Node.js.

No repositório, abra **Settings → Pages** e configure:

- **Source:** Deploy from a branch.
- **Branch:** main.
- **Folder:** /docs.

Salve e aguarde o GitHub concluir a publicação. O endereço publicado aparece na própria página de configurações do Pages.

A agenda desta demonstração é local a cada navegador e não sincroniza reservas entre clientes. A área demonstrativa do proprietário fica no botão do rodapé; não há uma rota `/admin` no GitHub Pages. A agenda compartilhada com acesso autenticado exige hospedar a aplicação Node.js e o banco persistente descritos no README principal.

Para atualizar esta cópia após alterar o projeto, execute `npm run export`. O comando recria `docs/index.html`, o `index.html` completo da raiz, os arquivos de demonstração e o ZIP de download. A aplicação com servidor usa a entrada separada `web/index.html`.
