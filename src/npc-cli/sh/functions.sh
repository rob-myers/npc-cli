# range 10
# range 2 ** 10
# range '8 << 1'
range() {
  call '({ args }) =>
    Array.from({
      length: Function(\`return \${args.join(" ")}\`)()
    }).map((_, i) => i);
  ' "$@"
}

# seq 10
# seq 2 ** 10
seq() {
  range "$@" | split
}

pretty() {
  map '(x, { api }) => api.pretty(x)'
}
