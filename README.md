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
| Banco de dados | PostgreSQL com Prisma (ORM) |
| Tempo real | WebSocket |
| Autenticação | JWT |

## Interface

Visual minimalista: poucas cores, bastante espaço em branco e só o que é necessário em cada tela, para uma leitura tranquila ao longo do dia.

## Execução

O sistema roda em uma máquina e é acessado pelo navegador:

- **Local:** `http://localhost:<porta>`
- **Na rede:** `http://<ip-da-máquina>:<porta>`, para acesso a partir de outro dispositivo

As instruções de instalação serão adicionadas conforme o projeto for montado.

## Roadmap

- **V1 · Essencial:** login por convite, rotina do dia, tarefas, status, histórico, visão semanal.
- **V2 · Intermediário:** comentários, imprevistos, métricas, notificações.
- **V3 · Avançado:** relatórios, integrações, backup/exportação.
