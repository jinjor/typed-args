import { deepStrictEqual } from "assert";
import { getArgs } from "../src";

function test(name: string, f: Function) {
  try {
    console.log(`testing "${name}" ...`);
    f();
    setTimeout(() => {
      console.log("✅ " + name);
    }, 0);
  } catch (e) {
    setTimeout(() => {
      console.log("❌ " + name);
      console.log(e.message);
    }, 0);
  }
}

test("targets and rest", () => {
  const cmd = "a b - -- -a --foo";
  const opt = {} as const;
  const expected = {
    targets: ["a", "b", "-"],
    options: {},
    rest: ["-a", "--foo"],
  };
  const actual = getArgs(cmd.split(/\s+/), opt);
  deepStrictEqual(actual, expected);
});
test("example", () => {
  const cmd = "a b -b 2 --baz2 --flag";
  const opt = {
    a: `--foo:number[]=[42] hogehoge`,
    b: `-b,--bar:number=42 fugafuga`,
    c: `--baz:string piyopiyo"`,
    d: `--baz2:string! piyopiyo(required)`,
    e: `--flag:boolean a flag`,
  } as const;
  const actual = getArgs(cmd.split(/\s+/), opt);
  console.log(actual);
});
