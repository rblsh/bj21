# bj21.rblsh.com

Игра уже в проде: **https://bj21.rblsh.com** (он же https://bj21.pages.dev).

## Как это устроено сейчас

- Cloudflare Pages, проект `bj21` в аккаунте Rbl@mediacube.io, режим **прямой загрузки** (не из Git)
- Домен `bj21.rblsh.com` добавлен кастомным доменом, CNAME на `bj21.pages.dev` создан автоматически, зона та же
- Приложения Cloudflare Access на поддомене нет: игра открывается без входа
- `_headers` задаёт кэш: `index.html`, `sw.js` и манифест без кэша, `js` и `css` на час, иконки на неделю. Проверено в проде заголовками ответа
- Локальный git-репозиторий инициализирован, первый коммит на месте, удалёнки нет

## Выкатить новую версию

Одной командой с мака (в VM сети нет, гнать надо из обычного терминала):

```bash
cd "~/Documents/Coding/Claude Code/bj21"
../gs-notify/node_modules/.bin/wrangler pages deploy . --project-name=bj21
```

Либо через панель: Workers & Pages -> bj21 -> Create deployment -> перетащить папку или zip.

**Перед каждой выкаткой поднимать `CACHE` в `sw.js`** (сейчас `bj21-v2`). Service worker ходит network-first, поэтому свежий код подхватится и так, но офлайн-копия обновится только на новом имени кэша.

## Если захочется деплой на пуше, как у rbl-space

Проект прямой загрузки МОЖНО подключить к Git позже, кнопка есть: bj21 -> Settings -> Build -> Git repository -> Connect.

```bash
cd "~/Documents/Coding/Claude Code/bj21"
gh repo create rblsh/bj21 --private --source=. --remote=origin --push
```

Дальше в панели Connect, ветка `main`, build command пустой, output directory `/`. После этого каждый push выкатывается сам, а домен и настройки остаются на месте.

## Проверка после выкатки

- Открыть домен, сыграть раздачу, посмотреть консоль
- На телефоне: «На экран «Домой»» ставит приложение, оно открывается без адресной строки и работает в самолётном режиме
