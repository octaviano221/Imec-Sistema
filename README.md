# IMEC Compliance Industrial v1.0

Sistema industrial da IMEC para controle de NRs, certificados, funcionários, equipamentos, vencimentos, documentos em PDF, QR Code de validação e gestão de conformidade técnica.

## 🏗️ Arquitetura

```
imec-compliance-industrial/
├── backend/          # Node.js + Express API
├── frontend/         # Interface web (HTML/CSS/JS)
├── database/         # Schema MySQL e seed data
└── README.md
```

## 🚀 Tecnologias

- **Backend:** Node.js, Express, MySQL2, JWT, Multer
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla), TailwindCSS
- **Banco de Dados:** MySQL 8.0+
- **Segurança:** JWT, bcrypt, Helmet, Rate Limiting

## 📋 Pré-requisitos

- Node.js 18+
- MySQL 8.0+
- npm ou yarn

## 🔧 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/octaviano12-prog/IMEC-Compliance-Industrial.git
cd IMEC-Compliance-Industrial
```

### 2. Configure o banco de dados

```bash
# Acesse o MySQL
mysql -u root -p

# Importe o schema
source database/schema.sql
```

Ou use o comando:

```bash
mysql -u root -p < database/schema.sql
```

### 3. Configure o backend

```bash
cd backend

# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env com suas configurações
nano .env
```

Variáveis necessárias no `.env`:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=imec_compliance

JWT_SECRET=gere_uma_chave_secreta_forte_aqui
JWT_EXPIRES_IN=7d

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

CORS_ORIGIN=http://localhost:3000
```

### 4. Instale as dependências

```bash
# Backend
cd backend
npm install

# Frontend (se necessário)
cd ../frontend
# Não requer instalação - é HTML/CSS/JS puro
```

### 5. Execute o sistema

```bash
# No diretório backend
npm start

# Ou para desenvolvimento com auto-reload
npm run dev
```

O sistema estará disponível em: **http://localhost:3000**

## 👤 Usuários Padrão

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Administrador | admin@imec.com.br | admin123 |
| Engenharia | eng@imec.com.br | admin123 |
| RH / Segurança | rh@imec.com.br | admin123 |
| Visualizador | view@imec.com.br | admin123 |

**⚠️ IMPORTANTE:** Altere as senhas padrão após o primeiro acesso!

## 📦 Módulos do Sistema

### Gestão de Pessoas
- **Funcionários** - Cadastro completo com abas (Dados, NRs, ASO, EPI, Obras)
- **NRs / Treinamentos** - 16 treinamentos pré-cadastrados
- **Certificados** - Geração automática de código único e QR Code
- **ASO** - Controle de atestados de saúde ocupacional
- **EPI** - Registro de entregas de equipamentos de proteção

### Gestão de Equipamentos
- **Equipamentos** - CRUD completo com documentos vinculados
- **Guindastes / Munck** - Tela específica com status de laudos
- **Documentos** - Laudos, ARTs, tabelas de carga

### Operações
- **Clientes** - Cadastro de clientes
- **Obras** - Vinculação de funcionários, equipamentos e documentos
- **ART / APR / Rigging** - Controle de documentos técnicos
- **Matriz de Competência** - Verificação automática de aptidão

### Sistema
- **Dashboard** - Cards com indicadores e alertas em tempo real
- **Relatórios** - 8 tipos de relatórios com exportação CSV
- **Configurações** - Dados da empresa e parâmetros do sistema
- **Auditoria** - Histórico de todas as ações

## 🔐 Segurança

- Autenticação JWT com expiração configurável
- Senhas criptografadas com bcrypt
- Controle de permissões por perfil (admin, engenharia, RH, viewer, cliente)
- Rate limiting para proteção contra ataques
- Helmet para headers de segurança
- CORS configurável
- Validação de arquivos upload

## 📱 Validação Pública de Certificados

O sistema possui página pública para validação de certificados via QR Code:

- Acesse: `http://localhost:3000/#/verificar/{token}`
- Ou use o botão "Consultar Certificado" no topo do sistema
- Não requer login
- Protege dados sensíveis (CPF mascarado - LGPD)

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

- `users` - Usuários do sistema
- `employees` - Funcionários
- `trainings` - Tipos de treinamento/NRs
- `certificates` - Certificados emitidos
- `medical_exams` - ASOs
- `epi_records` - EPIs entregues
- `equipment` - Equipamentos
- `equipment_documents` - Documentos de equipamentos
- `clients` - Clientes
- `projects` - Obras/serviços
- `project_employees` - Funcionários em obras
- `project_equipment` - Equipamentos em obras
- `technical_documents` - ARTs, APRs, Planos de Rigging
- `competency_requirements` - Requisitos de competência
- `audit_logs` - Logs de auditoria
- `system_settings` - Configurações do sistema

## 🌐 Deploy em Produção

### Opção 1: VPS (DigitalOcean, AWS, etc.)

1. Configure um servidor com Node.js e MySQL
2. Clone o repositório
3. Configure o `.env` com credenciais de produção
4. Use PM2 para gerenciar o processo:

```bash
npm install -g pm2
pm2 start server.js --name imec-compliance
pm2 save
pm2 startup
```

5. Configure Nginx como reverse proxy
6. Use Let's Encrypt para SSL

### Opção 2: Hostinger

1. Acesse o hPanel > Bancos de Dados > MySQL
2. Crie um banco de dados
3. Importe o `database/schema.sql`
4. Acesse o Gerenciador de Arquivos
5. Faça upload dos arquivos do projeto
6. Configure o `.env` com as credenciais do banco
7. O sistema estará disponível no seu domínio

### Opção 3: Docker (futuro)

```dockerfile
# Dockerfile exemplo
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./
COPY frontend/ ../frontend/
EXPOSE 3000
CMD ["node", "server.js"]
```

## 📝 Scripts Úteis

```bash
# Desenvolvimento
npm run dev

# Produção
npm start

# Importar banco de dados
mysql -u root -p < database/schema.sql

# Gerar JWT_SECRET forte
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 🐛 Troubleshooting

### Erro de conexão com MySQL
- Verifique se o MySQL está rodando
- Confirme as credenciais no `.env`
- Verifique se o banco `imec_compliance` existe

### Erro 401 Unauthorized
- Verifique se o token JWT não expirou
- Faça login novamente
- Confirme o `JWT_SECRET` no `.env`

### Erro ao fazer upload de arquivos
- Verifique a permissão da pasta `backend/uploads`
- Confirme o `MAX_FILE_SIZE` no `.env`
- Verifique o tipo de arquivo permitido

## 📄 Licença

Este projeto é proprietário da IMEC Soluções Industriais.

## 🤝 Suporte

Para suporte técnico, entre em contato:
- E-mail: suporte@imec.com.br
- Telefone: (16) 3333-0000

---

**IMEC Compliance Industrial v1.0** - Sistema de Gestão de Conformidade Industrial
