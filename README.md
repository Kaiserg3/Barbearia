# BRAVO. Barbearia

Site responsivo de uma barbearia fictícia, com apresentação, serviços e preços, equipe e agendamento funcional. Todo o conteúdo comercial é demonstrativo; as reservas não são encaminhadas a um estabelecimento real e nenhuma mensagem é enviada.

![Visual da página inicial da BRAVO. Barbearia](preview/site.png)

## Baixar e abrir o site pronto

Use o [download direto do site pronto](https://github.com/Kaiserg3/Barbearia/raw/refs/heads/main/downloads/BRAVO-Barbearia.zip). Extraia o ZIP e abra **ABRIR-BARBEARIA.html** no Chrome, Edge ou Firefox. Esse pacote contém somente um HTML completo, com imagens, fontes e agendamento demonstrativo local, e não exige Node.js ou instalação.

A página completa também está em **`index.html`** e **`ABRIR-BARBEARIA.html`**, na raiz deste repositório. Esses arquivos incluem a apresentação, os serviços e a agenda demonstrativa; não são telas de carregamento. Eles mantêm o código e os estilos no próprio HTML e carregam fotografias e fontes pela internet. O arquivo original de 2 MB pode ultrapassar o limite do visualizador de arquivos do GitHub; a versão menor evita esse problema de tamanho. O visualizador de código do GitHub não renderiza arquivos HTML como uma página de site.

## Publicar como um site pelo navegador

O GitHub exibe o código dos arquivos HTML. Para abrir a demonstração como um site navegável, os arquivos prontos para **GitHub Pages** estão na pasta `docs/`.

Abra [Settings → Pages](https://github.com/Kaiserg3/Barbearia/settings/pages), selecione **Deploy from a branch**, escolha a branch **main** e a pasta **/docs**, e clique em **Save**. Aguarde a publicação terminar; o GitHub mostrará o link do site nessa tela. Enviar os arquivos ao repositório não ativa o Pages automaticamente.

Essa publicação permite visualizar o site e testar a agenda demonstrativa local. A versão completa com reservas compartilhadas e login do proprietário exige a hospedagem Node.js descrita abaixo.

## Executar

Requer **Node.js 24 ou superior** e npm. O SQLite é fornecido pelo próprio Node; o site público não exige um banco separado ou credenciais. A consulta privada do proprietário exige a configuração descrita abaixo.

Depois de clonar ou baixar este repositório, abra um terminal na pasta do projeto. No ambiente da nuvem, ela fica em `/workspace/Barbearia`; na sua máquina, use a pasta em que você extraiu ou clonou o projeto.

```bash
cd /workspace/Barbearia
npm ci --cache /tmp/bravo-npm-cache
npm run dev
```

O Vite usa a porta **5173** e encaminha `/api` ao servidor na porta **3001**. Para conferir a API localmente:

```bash
curl --fail http://127.0.0.1:3001/api/health
```

## Verificar e executar a versão de produção

```bash
npm test
npm run build
npm start
```

Em produção, o Express entrega o site compilado e a API juntos na porta 3001. `PORT` altera essa porta. O comando de desenvolvimento pressupõe que a API esteja na porta 3001.

## Abrir uma demonstração sem servidor

Uma cópia completa pronta para abrir está em **`demo/BRAVO-Barbearia.html`** e no pacote **`downloads/BRAVO-Barbearia.zip`**. O pacote traz apenas o HTML pronto, com o nome **ABRIR-BARBEARIA.html**, para evitar confusão com os arquivos de desenvolvimento. Essa cópia inclui todo o visual e a agenda local demonstrativa, sem precisar instalar Node.js.

A entrada da aplicação com servidor fica em **`web/index.html`** e é usada pelo Vite. O `index.html` da raiz é a demonstração pronta para abrir, com o conteúdo completo e sem imports de módulos externos. Para gerar novamente a versão independente completa, execute:

```bash
npm run build:preview
```

Abra `dist/BRAVO-Barbearia.html`. Esse arquivo inclui JavaScript, estilos, fontes e fotografias, sem solicitar arquivos externos. O conteúdo também aparece em visualizadores que bloqueiam JavaScript, mas os botões precisam de JavaScript para funcionar.

Para gerar a variante menor, execute `npm run build:light`. A saída é `dist/ABRIR-BARBEARIA.html`; atualize a cópia da raiz e `docs/index.html` ao preparar uma nova entrega. A variante menor mantém os estilos e o JavaScript embutidos e usa os recursos públicos deste repositório para carregar fotos e fontes.

Para atualizar todas as cópias de entrega de uma vez, execute **`npm run export`**. Esse comando requer Python 3 apenas para montar o ZIP e copia a página completa para `index.html`, `ABRIR-BARBEARIA.html`, `docs/index.html` e o pacote de download. Use-o explicitamente ao preparar uma publicação; ele atualiza os arquivos de demonstração versionados. Os comandos normais `npm run dev` e `npm run build` continuam usando a entrada separada em `web/`.

Nesta versão independente, a agenda é uma simulação local, separada da API e do banco de dados do site. Os horários ficam apenas neste navegador; se o visualizador bloquear o armazenamento, duram apenas enquanto a página estiver aberta. Não são sincronizados entre clientes. O arquivo informa essa diferença ao agendar. A versão completa continua usando o servidor e o SQLite.

## Agendamentos

- Seleção de serviço, profissional, data e horário, seguida dos dados do cliente.
- Calendário visual com seleção de dia, navegação entre meses e horários disponíveis após a escolha do profissional.
- Funcionamento de terça a sábado, das 9h às 19h, no fuso `America/Fortaleza`.
- Agenda de hoje até 60 dias à frente, com inícios a cada 30 minutos.
- Duração real do serviço considerada: 40 minutos para corte, 30 para barba, 70 para combo e 20 para acabamento.
- Validação no servidor, bloqueio transacional de sobreposições e limite de tentativas.
- Confirmação com referência e arquivo `.ics` para adicionar ao calendário.
- As reservas ficam em `data/bookings.sqlite`, fora do Git. `DB_PATH` pode apontar para outro banco. Preserve esse arquivo para manter as reservas e seus backups fora de diretórios públicos.
- Não há cancelamento, pagamento, envio de WhatsApp/SMS ou integração com agendas externas nesta versão.

Os testes usam bancos isolados e cobrem persistência, concorrência, conflitos entre serviços, fuso, datas, validação e limite de tentativas. Para uma conferência no navegador, faça uma reserva com dados fictícios, reabra a agenda para o mesmo profissional e verifique que os horários que se sobrepõem desapareceram.

## Como o proprietário consulta as reservas

Clique em **Área do proprietário** no rodapé ou acesse a rota `/admin` na mesma hospedagem do site. O painel mostra os agendamentos por dia e profissional, com horário, serviço, duração, cliente, telefone, referência e valor. A agenda é atualizada a cada 30 segundos e também pode ser atualizada manualmente. Os totais representam serviços agendados, sem contabilizar pagamentos recebidos.

Na versão com servidor, configure **`BRAVO_ADMIN_PASSWORD`** no ambiente do processo, com uma senha exclusiva de pelo menos 12 caracteres, e reinicie o servidor. Não há senha padrão. Não coloque a senha em arquivos versionados ou no HTML de demonstração. Essa variável é lida localmente pelo servidor; um segredo com valor substituído apenas por um proxy HTTPS não serve para autenticar o painel.

Sem essa variável, a área permanece desativada e nenhuma lista de clientes é exposta. A sessão usa cookie HttpOnly, SameSite Strict e expira após 8 horas ou ao reiniciar o servidor. Em produção, o cookie exige **HTTPS**; configure o proxy de hospedagem para preservar o Host original. O proxy de desenvolvimento já faz isso.

No HTML independente, o botão **Ver agenda de demonstração** permite conhecer o painel com as reservas deste navegador. Ele mostra dados de exemplo e não guarda nome ou telefone. Esse modo local não oferece acesso às reservas feitas por outras pessoas; o atendimento compartilhado exige o site completo hospedado, com a API e o banco persistente.

## Personalizar

O catálogo, os profissionais, o endereço de exemplo no Meireles em Fortaleza e as regras de agenda estão em `server/index.js`. Os textos e os cartões da página estão em `src/App.jsx`; mantenha seus valores alinhados ao catálogo ao personalizar. O visual original em creme, grafite e dourado está em `src/styles.css`. O calendário está em `src/BookingCalendar.jsx` e o painel em `src/OwnerPanel.jsx`.

Antes de usar com uma empresa real, substitua os dados fictícios, ajuste os avisos de demonstração e configure hospedagem HTTPS, armazenamento persistente com backup e a política de privacidade adequada ao atendimento.

As fotografias de exemplo têm origem registrada em `public/images/credits.json`. As fontes Instrument Serif e DM Sans são distribuídas sob a SIL Open Font License; os avisos estão em `public/fonts/`.

Cada tarefa da nuvem já tem um ambiente isolado. Utilize este checkout existente; não é necessário criar uma Git worktree. Dependências, banco e arquivos compilados são retidos no disco, mas os processos devem ser iniciados novamente em cada ambiente restaurado.
