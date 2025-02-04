declare type Pretty<T> = T extends unknown ? { [K in keyof T]: T[K] } : never;

type Meta<T extends {} = {}> = Record<string, any> & T;
