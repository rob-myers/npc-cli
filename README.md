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

Use VSCode plugin ` WebGL GLSL Editor` for syntax highlighting (*.glsl + inline-strings).

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

# autocrop an image using ImageMagick (overwriting it)
srcPath=media/edited/extra--009--table--4x4.png
dstPath=media/edited/extra--009--table--4x4.trim.png
convert -fuzz 1% -trim "$srcPath" "$dstPath" && mv "$dstPath" "$srcPath"

# greyscale
convert -colorspace Gray myImage.png  myImage.gray.png
```

We use `dot` (graphviz) to visualized directed graphs.
> https://graphviz.org/documentation/

```sh
brew install graphviz
```

## Starship Symbols Source PNGs

Symbol PNGs should be unzipped in /media
- [SymbolsHighRes.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/SymbolsHighRes.zip)
- [SmallCraftHighRes.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/SmallCraftHighRes.zip)

Geomorph PNGs (background in hull symbols) should be unzipped in /media
- [Geomorphs.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/Geomorphs.zip)

Related resources (less/more resolution)
- [Symbols.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/Symbols.zip)
- [GeomorphsHighRes.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/GeomorphsHighRes.zip)

## CodeSandboxes

[CharacterShaderTest](https://codesandbox.io/p/github/rob-myers/three-js-examples/test-branch?layout=%257B%2522sidebarPanel%2522%253A%2522EXPLORER%2522%252C%2522rootPanelGroup%2522%253A%257B%2522direction%2522%253A%2522horizontal%2522%252C%2522contentType%2522%253A%2522UNKNOWN%2522%252C%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522id%2522%253A%2522ROOT_LAYOUT%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522UNKNOWN%2522%252C%2522direction%2522%253A%2522vertical%2522%252C%2522id%2522%253A%2522clvqpbvf700083b6nuxutsh34%2522%252C%2522sizes%2522%253A%255B70%252C30%255D%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522EDITOR%2522%252C%2522direction%2522%253A%2522horizontal%2522%252C%2522id%2522%253A%2522EDITOR%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL%2522%252C%2522contentType%2522%253A%2522EDITOR%2522%252C%2522id%2522%253A%2522clvqpbvf700023b6naehyfnvg%2522%257D%255D%257D%252C%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522SHELLS%2522%252C%2522direction%2522%253A%2522horizontal%2522%252C%2522id%2522%253A%2522SHELLS%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL%2522%252C%2522contentType%2522%253A%2522SHELLS%2522%252C%2522id%2522%253A%2522clvqpbvf700053b6nfo8hm6cw%2522%257D%255D%252C%2522sizes%2522%253A%255B100%255D%257D%255D%257D%252C%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522DEVTOOLS%2522%252C%2522direction%2522%253A%2522vertical%2522%252C%2522id%2522%253A%2522DEVTOOLS%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL%2522%252C%2522contentType%2522%253A%2522DEVTOOLS%2522%252C%2522id%2522%253A%2522clvqpbvf700073b6ngqvj3f3x%2522%257D%255D%252C%2522sizes%2522%253A%255B100%255D%257D%255D%252C%2522sizes%2522%253A%255B50%252C50%255D%257D%252C%2522tabbedPanels%2522%253A%257B%2522clvqpbvf700023b6naehyfnvg%2522%253A%257B%2522tabs%2522%253A%255B%257B%2522id%2522%253A%2522clvqpbvf700013b6no0b0n3r9%2522%252C%2522mode%2522%253A%2522permanent%2522%252C%2522type%2522%253A%2522FILE%2522%252C%2522filepath%2522%253A%2522%252FREADME.md%2522%252C%2522state%2522%253A%2522IDLE%2522%257D%255D%252C%2522id%2522%253A%2522clvqpbvf700023b6naehyfnvg%2522%252C%2522activeTabId%2522%253A%2522clvqpbvf700013b6no0b0n3r9%2522%257D%252C%2522clvqpbvf700073b6ngqvj3f3x%2522%253A%257B%2522tabs%2522%253A%255B%257B%2522id%2522%253A%2522clvqpbvf700063b6nj34kwxof%2522%252C%2522mode%2522%253A%2522permanent%2522%252C%2522type%2522%253A%2522TASK_PORT%2522%252C%2522taskId%2522%253A%2522dev%2522%252C%2522port%2522%253A5173%252C%2522path%2522%253A%2522%252F%253Fcomponent%253DCharacterShaderTest%2522%257D%255D%252C%2522id%2522%253A%2522clvqpbvf700073b6ngqvj3f3x%2522%252C%2522activeTabId%2522%253A%2522clvqpbvf700063b6nj34kwxof%2522%257D%252C%2522clvqpbvf700053b6nfo8hm6cw%2522%253A%257B%2522tabs%2522%253A%255B%257B%2522id%2522%253A%2522clvqpbvf700033b6n6cfo4x0t%2522%252C%2522mode%2522%253A%2522permanent%2522%252C%2522type%2522%253A%2522TASK_LOG%2522%252C%2522taskId%2522%253A%2522dev%2522%257D%252C%257B%2522id%2522%253A%2522clvqpbvf700043b6nq1lxspli%2522%252C%2522mode%2522%253A%2522permanent%2522%252C%2522type%2522%253A%2522TERMINAL%2522%252C%2522shellId%2522%253A%2522clvqbqudf001yddgyh82hfhyq%2522%257D%255D%252C%2522id%2522%253A%2522clvqpbvf700053b6nfo8hm6cw%2522%252C%2522activeTabId%2522%253A%2522clvqpbvf700033b6n6cfo4x0t%2522%257D%257D%252C%2522showDevtools%2522%253Atrue%252C%2522showShells%2522%253Atrue%252C%2522showSidebar%2522%253Atrue%252C%2522sidebarPanelSize%2522%253A15%257D)