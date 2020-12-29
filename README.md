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
  /* prettier-ignore */
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
