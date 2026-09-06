# Выкатка bj21.rblsh.com

Сайт статический, сборки нет: в прод уезжает папка как есть.

## Что уже сделано

- Локальный репозиторий инициализирован, первый коммит на месте
- `_headers` задаёт кэш: оболочка (`index.html`, `sw.js`, манифест) без кэша, ассеты на час, иконки на неделю

## Вариант 1: через GitHub, деплой на пуше (как у rbl-space)

```bash
cd "~/Documents/Coding/Claude Code/bj21"
gh repo create rblsh/bj21 --private --source=. --remote=origin --push
# или руками: создать пустой репозиторий rblsh/bj21 на github.com, затем
# git remote add origin git@github.com:rblsh/bj21.git && git push -u origin main
```

Дальше в Cloudflare: Workers & Pages -> Create -> Pages -> Connect to Git -> репозиторий `bj21`.
Build command оставить пустым, output directory `/`. После первой сборки: Custom domains -> Set up a custom domain -> `bj21.rblsh.com` (зона `rblsh.com` уже в этом аккаунте, CNAME создастся сам).

Дальше каждый push в main выкатывается сам.

## Вариант 2: прямая загрузка одной командой

```bash
cd "~/Documents/Coding/Claude Code/bj21"
../gs-notify/node_modules/.bin/wrangler pages deploy . --project-name=bj21
```

Первый запуск создаст проект. Домен всё равно добавляется в панели один раз.

## При каждой следующей выкатке

Поднимать `CACHE` в `sw.js` (сейчас `bj21-v2`). Иначе у тех, кто уже открывал игру, останется старая оболочка: service worker ходит network-first, но офлайн-копия обновится только на новом имени кэша.

## Проверка после выкатки

- Открыть https://bj21.rblsh.com, сыграть раздачу, посмотреть консоль
- Убедиться, что на поддомен НЕ распространяется приложение Cloudflare Access: игра публичная, входа быть не должно
- На телефоне: «На экран «Домой»» ставит приложение, оно открывается без адресной строки и работает в самолётном режиме
