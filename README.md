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

We use `convert` from ImageMagick.

```sh
brew install imagemagick

# exit code 0 <=> installed
convert --version | grep ImageMagick >/dev/null && echo $?

# autocrop an image using ImageMagick
convert -fuzz 1% -trim myImage.png myImage.png

# greyscale
convert -colorspace Gray myImage.png  myImage.gray.png
```

## Starship Symbols Source PNGs

Symbol PNGs should be unzipped in /media
- [SymbolsHighRes.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/SymbolsHighRes.zip)

Geomorph PNGs (background in hull symbols) should be unzipped in /media
- [Geomorphs.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/Geomorphs.zip)

Related resources (less/more resolution)
- [Symbols.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/Symbols.zip)
- [GeomorphsHighRes.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/GeomorphsHighRes.zip)
