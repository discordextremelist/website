// from https://twitter.com/diegohaz/status/1309489079378219009?s=20

type PathImpl<T, Key extends keyof T> =
Key extends string
? T[Key] extends Record<string, any>
  ? | `${Key}.${PathImpl<T[Key], Exclude<keyof T[Key], keyof any[]>> & string}`
    | `${Key}.${Exclude<keyof T[Key], keyof any[]> & string}`
  : never
: never;

type PathImpl2<T> = PathImpl<T, keyof T> | keyof T;

export type Keys<T> = PathImpl2<T> extends string | keyof T ? PathImpl2<T> : keyof T;
