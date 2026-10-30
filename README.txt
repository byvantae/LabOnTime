LABONTIME — CONFIGURAÇÃO E PUBLICAÇÃO

1. Em firebase-config.js, substitua os valores de exemplo pelos dados reais do Firebase: Console > Configurações do projeto > Geral > Seus apps > SDK da Web.
2. No Firebase Authentication, habilite E-mail/senha.
3. Em Authentication > Users, crie manualmente as contas dos professores. Não há cadastro público.
4. No Firestore Database > Rules, publique as regras do arquivo firestore.rules ou confira se as regras existentes são compatíveis.
5. No GitHub, crie um repositório e envie os arquivos desta pasta para a raiz: index.html, styles.css, app.js e firebase-config.js.
6. GitHub > Settings > Pages > Build and deployment > Deploy from a branch > main > /(root).
7. Aguarde o endereço do site. Use HTTPS; não abra os arquivos por file://.

Inclui login, agenda em tempo real, dois laboratórios, blocos de 50 minutos, prevenção de reservas duplicadas por transação, cancelamento pelo criador e tema claro/escuro.
Visual inspirado em glassmorphism e na estética translúcida do iOS; não é uma cópia oficial da Apple.
Antes de usar em produção, teste as regras do Firestore com contas de professor.
