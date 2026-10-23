# Demonstração no GitHub Pages

Esta pasta contém o site demonstrativo pronto para servir como uma página estática. `index.html` inclui código, fontes, estilos e fotografias, e funciona no caminho `/Barbearia/` sem serviços externos.

No repositório, abra **Settings → Pages** e configure:

- **Source:** Deploy from a branch.
- **Branch:** main.
- **Folder:** /docs.

Salve e aguarde o GitHub concluir a publicação. O endereço publicado aparece na própria página de configurações do Pages.

A agenda desta demonstração é local a cada navegador e não sincroniza reservas entre clientes. A área demonstrativa do proprietário fica no botão do rodapé; não há uma rota `/admin` no GitHub Pages. A agenda compartilhada com acesso autenticado exige hospedar a aplicação Node.js e o banco persistente descritos no README principal.

Para atualizar esta cópia após alterar o projeto, execute `npm run build:preview` e copie `dist/BRAVO-Barbearia.html` para `docs/index.html` e `demo/BRAVO-Barbearia.html` antes de enviar a nova versão ao GitHub.
