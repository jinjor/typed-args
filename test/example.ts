import { parseArgs } from "../src";

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
