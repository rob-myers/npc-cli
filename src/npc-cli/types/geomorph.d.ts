declare namespace Geomorph {
  export type GeomorphKey =
    | "g-101--multipurpose"
    | "g-102--research-deck"
    | "g-103--cargo-bay"
    | "g-301--bridge"
    | "g-302--xboat-repair-bay"
    | "g-303--passenger-deck";

  interface GeomorphsDefItem {
    gmKey: GeomorphKey;
    transform?: [number, number, number, number, number, number];
  }
}
