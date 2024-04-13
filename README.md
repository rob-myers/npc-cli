# NPC CLI

Towards believable NPCs.

```sh
# full dev env e.g. auto-update assets/images
npm run dev
yarn dev

# manual dev env
npm run develop
yarn develop
```

## Gotchas

Configure Giscus using https://giscus.app/.

Use VSCode plugin `Prettier - Code formatter`,
published by `Prettier`.

## Optional Dependencies

We use `xargs` for parallelisation of commands.

```sh
# for `yarn cwebp '{ "files": [...] }'`
brew install webp
```
