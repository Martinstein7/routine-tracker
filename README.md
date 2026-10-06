# Routine Tracker

Aplicação web para acompanhar a rotina de trabalho do dia a dia, compartilhada em tempo real entre mim e a minha gestora.

> Status: em desenvolvimento (V1).

## Objetivo

- Organizar a rotina diária em uma linha do tempo com horário, categoria, prioridade e status.
- Permitir que a gestora acompanhe o progresso, crie tarefas e comente, sem acesso à estrutura do sistema.
- Registrar tudo o que acontece (alterações, comentários, imprevistos) em um histórico.
- Atualizar a tela das duas pessoas em tempo real, sem recarregar a página.

## Fluxo

```
Login ──► Identificar usuário (Admin / Gestora) ──► Dashboard
                                                      ├── Hoje ──► Atividades ──► Editar · Status · Comentário
                                                      ├── Semana / Calendário
                                                      └── Histórico

Ação ──► API (backend) ──► PostgreSQL ──► Evento WebSocket ──► Outro usuário é atualizado
```

## Acesso

- Não existe cadastro público. A tela de login é a única porta de entrada.
- Novas contas só são criadas por **convite**: o admin gera um link de criação de conta e escolhe o tipo de acesso (Admin ou Gestora).
- O link expira e só pode ser usado uma vez.

## Permissões

Legenda: ✅ permitido · ⚪ desativado por padrão, o admin pode liberar · ❌ bloqueado

| Função | Admin | Gestora |
|---|:---:|:---:|
| Acessar dashboard | ✅ | ✅ |
| Visualizar a rotina | ✅ | ✅ |
| Visualizar calendário | ✅ | ✅ |
| Criar tarefas para o admin | ✅ | ✅ |
| Criar tarefas próprias | ✅ | ⚪ |
| Editar tarefas | ✅ | ✅ |
| Excluir tarefas | ✅ | ⚪ |
| Alterar horário | ✅ | ✅ |
| Alterar prioridade | ✅ | ✅ |
| Alterar categoria | ✅ | ⚪ |
| Alterar status | ✅ | ✅ |
| Marcar tarefa como concluída | ✅ | ✅ |
| Adicionar comentários | ✅ | ✅ |
| Visualizar comentários | ✅ | ✅ |
| Registrar imprevistos | ✅ | ⚪ |
| Visualizar imprevistos | ✅ | ✅ |
| Reordenar a rotina | ✅ | ✅ |
| Criar tarefas recorrentes | ✅ | ⚪ |
| Visualizar histórico | ✅ | ✅ |
| Editar/apagar histórico | ✅ | ❌ |
| Visualizar relatórios | ✅ | ✅ |
| Criar/editar relatórios | ✅ | ⚪ |
| Visualizar métricas de produtividade | ✅ | ✅ |
| Gerenciar categorias | ✅ | ❌ |
| Gerenciar usuários | ✅ | ❌ |
| Alterar permissões | ✅ | ❌ |
| Aparência pessoal (tema claro/escuro e cores) | ✅ | ✅ |
| Configurações do sistema | ✅ | ❌ |
| Configurar integrações | ✅ | ❌ |
| Backup/exportação | ✅ | ❌ |
| Logs do sistema | ✅ | ❌ |

Na prática, a gestora atua em seis áreas: **rotina** (visualizar, criar, editar, horário, prioridade, status), **acompanhamento** (progresso, concluídas, atrasos, imprevistos), **comunicação** (comentar e ler comentários), **calendário** (ver e ajustar compromissos da rotina), **relatórios** (indicadores e histórico). Nada relacionado à estrutura do sistema.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Fastify |
| Banco de dados | PostgreSQL (embutido no projeto) com Prisma (ORM) |
| Tempo real | WebSocket |
| Autenticação | JWT |

## Interface

Visual minimalista: poucas cores, bastante espaço em branco e só o que é necessário em cada tela, para uma leitura tranquila ao longo do dia.

## Telas

| Tela | O que tem |
|---|---|
| **Hoje** | Resumo do dia, rotina em linha do tempo (o círculo de cada tarefa conclui com um clique), atividade atual com cronômetro, atividades sob demanda, comentários, imprevistos e resumo da semana |
| **Calendário** | Visão de semana e de mês; clique em um dia para adicionar tarefa |
| **Tarefas** | Lista filtrável por período, status e busca, com conclusão rápida; atalho para as atrasadas |

**Dias bloqueados** (só o admin, em Configurações): bloqueie um dia ou período com um motivo (consulta, feriado, folga, férias…) e, se quiser, todos os fins de semana. Num dia bloqueado não dá para criar ou mover tarefas para ele, as recorrentes não aparecem e não se registram atividades sob demanda. O calendário e a tela Hoje mostram o bloqueio; a gestora vê, mas não altera. Ao bloquear, as tarefas em aberto do período podem ser removidas (as recorrentes voltam sozinhas se o dia for desbloqueado).

**Atividades sob demanda** são as que acontecem com frequência, mas sem horário fixo (ex.: atender um chamado). Ficam cadastradas no cartão "Sob demanda" da tela Hoje; quando uma surge, **Iniciar** cria a ocorrência no horário atual com cronômetro, e **Feita** registra como já concluída. Cada ocorrência entra na rotina do dia e nos relatórios.
| **Histórico** | Tudo o que foi feito, por pessoa e período, e a lista de imprevistos. Só o admin edita ou apaga |
| **Relatórios** | Taxa de conclusão, atrasos, tempo registrado, imprevistos e distribuição por dia, categoria, status e prioridade |
| **Configurações** | Aparência (tema claro, escuro ou automático e cores com seletor), de cada pessoa. Só admin: usuários, convites, permissões da gestora, categorias e backup |

## Instalação

Requisitos: **Node.js 20.12 ou mais novo** e **Git**. O PostgreSQL vem embutido no projeto (não precisa de Docker nem de instalação separada).

```bash
git clone https://github.com/Martinstein7/routine-tracker.git
cd routine-tracker
npm install

# Configuração: copie o exemplo e troque o JWT_SECRET por um texto longo e aleatório
cp server/.env.example server/.env

# Cria o banco, aplica as tabelas e as categorias padrão
npm run setup

# Compila o site
npm run build
```

Depois, ligue o servidor (`npm start`) e crie a sua conta de admin em **`http://localhost:3000/primeiro-acesso`**. É a única conta criada fora do convite: o link só funciona enquanto o sistema não tem nenhuma conta e só abre na própria máquina do servidor, nunca pela rede.

Se preferir pelo terminal:

```bash
npm run admin:create -- --name "Seu nome" --email voce@empresa.com --password "uma-senha-forte"
```

## Uso no dia a dia

```bash
npm start
```

Um único comando liga o banco e o servidor. O terminal mostra os dois endereços:

- **Na sua máquina:** `http://localhost:3000`
- **Para a gestora:** `http://<ip-da-sua-máquina>:3000`, na mesma rede

Para convidar a gestora, entre como admin, abra **Configurações → Convidar pessoa**, escolha **Gestora** e envie o link gerado. O link usa o IP da sua máquina, vale por 7 dias e funciona uma única vez.

### Acesso pela rede

- Na primeira vez que o servidor ligar, o Windows pode perguntar se o Node.js pode usar a rede. Permita em **redes privadas**.
- Se a gestora não conseguir abrir, libere a porta manualmente em um PowerShell como administrador:
  ```powershell
  New-NetFirewallRule -DisplayName "Routine Tracker" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Domain
  ```
- Se o IP da sua máquina mudar com frequência, peça um IP fixo para a TI ou defina `PUBLIC_URL` em `server/.env` (por exemplo, `PUBLIC_URL=http://192.168.0.50:3000`).

### Demonstração (para apresentar o projeto)

```bash
npm run build   # se ainda não compilou o site
npm run demo
```

Liga uma cópia de demonstração na porta **3001**, ao lado do sistema real e sem tocar nele: banco próprio (`server/.pgdata-demo`), dados fictícios e entrada direta, sem login, como o admin "Visitante".

- **Na sua máquina:** `http://localhost:3001`
- **Em outra máquina da mesma rede:** `http://<ip-da-sua-máquina>:3001` (o terminal mostra o endereço)

Quem estiver vendo pode clicar em tudo. Qualquer alteração é desfeita sozinha **10 minutos depois da primeira mudança**, e uma faixa no topo mostra o horário. Ao religar a demonstração, os dados também voltam ao original. Convites, desativar usuários e backup ficam bloqueados.

### Desenvolvimento

```bash
npm run dev
```

Liga o banco, a API com recarga automática (porta 3000) e o Vite (porta 5173). Abra `http://localhost:5173`.

Para alterar o banco, edite `server/prisma/schema.prisma` e rode `npm run db:migrate -w server` com o `npm run dev` ligado.

## Estrutura

```
routine-tracker/
├── server/                 API (Fastify), banco e tempo real
│   ├── prisma/             schema e migrações
│   └── src/
│       ├── routes/         auth, admin, tasks, activity, reports
│       ├── lib/            permissões, histórico, recorrência, WebSocket
│       └── scripts/        setup, criação do admin, banco embutido
└── web/                    site (React + Vite + Tailwind)
    └── src/
        ├── pages/          Hoje, Calendário, Tarefas, Histórico, Relatórios, Configurações
        ├── components/     layout, formulários e componentes de interface
        └── lib/            API, sessão, consultas e tempo real
```

Os dados ficam em `server/.pgdata` (fora do Git). Para backup, use **Configurações → Backup** ou copie essa pasta com o servidor desligado.

## Roadmap

- **V1 · Essencial** ✅ login por convite, rotina do dia, tarefas, status com cronômetro, histórico, calendário semanal e mensal.
- **V2 · Intermediário** ✅ comentários, imprevistos, métricas e relatórios, permissões configuráveis, tarefas recorrentes. Pendente: notificações (o sino).
- **V3 · Avançado:** criar/editar relatórios personalizados, integrações, logs do sistema.
