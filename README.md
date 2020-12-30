# typed-args

An experimental argv parser for TypeScript >= 4.1

## Install

.npmrc

```
@jinjor:registry=https://npm.pkg.github.com
```

```
npm install @jinjor/typed-args
```

## Example

```typescript
import { parseArgs } from "@jinjor/typed-args";

const args = process.argv.slice(2);
const {
  options: { port, address, cors },
} = parseArgs(
  args,
  // prettier-ignore
  {
      port:    `-p,--port:number=3000;         Port to use`,
      address: `-a,--address:string="0.0.0.0"; Address to use`,
      cors:    `--cors:boolean;                Enable CORS`,
      help:    `--help:boolean;                Show this help`,
  } as const,
  {
    usage: "command [<options>] <paths>...",
  }
);
console.log(port, address, cors);
```

`--help` outputs:

```
Usage: command [<options>] <paths>...
Options:
  -p, --port <number>    Port to use (default:3000)
  -a, --address <string> Address to use (default:"0.0.0.0")
  --cors                 Enable CORS
  --help                 Show this help
```

## API

```
parseArgs(args, definitions, options?): { targets, options, rest, help }
```

- `args`: the arguments, it is typically `process.argv.slice(2)`
- `definitions`: defines each option (see [Syntax](#syntax))
- `options`: see [Options](#Options)
- `rest`: the additional arguments after `--`
- `help`: the function to show help message
  - `help(exitCode)`: show help and exit
  - `help(null)`: return the help message as string

## Syntax

`(-$short,)--$long:$type(=$default|!)(;$description)`

- `$short`: single-charactor alias of $long option (e.g. `-a`, `-a 1`, `-a1`)
- `$long`: multi-caractor option (e.g. `--foo`, `--foo x`, `--foo=x`)
- `$type`: one of `boolean`, `number`, `number[]`, `string`, `string[]`
- `$default`: overrides the default value of each type (which is, `boolean`: `false`, `number`: `null`, `number[]`: `[]`, `string`: `null`, `string[]`: `[]`)
- `!`: the option is required (cannot be `null` after the default value is used)
- `$description`: what the option means

## Options

- `usage?: string`: if provided, help shows the usage at the top
- `exitOnError?: boolean`: exits if invalid args are passed, otherwise throws a `ValidationError` (default is `true`)
- `handleHelp?: boolean`: if `help` _key_ (NOT `--help`) exists, show help and exit
- `requireTarget?: string | boolean`: indicates the `targets` cannot be empty (optionally pass the error message)
