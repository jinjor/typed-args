import { deepStrictEqual, fail } from "assert";
import { getArgs, SettingsError } from "../src";

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
      console.log("    " + e.message);
    }, 0);
  }
}
function expectError(errorClass: any, f: Function): void {
  try {
    f();
    fail(`expected ${errorClass.name} to be thrown but no error was thrown`);
  } catch (e: any) {
    if (e instanceof errorClass) {
      return;
    }
    fail(
      `expected ${errorClass.name} to be thrown but got another error: ${e.message}`
    );
  }
}

const options = { showHelp: false, exitOnError: false };

{
  for (const s of [
    `--a:boolean=1`,
    `--a:boolean=""`,
    `--a:number=true`,
    `--a:number=""`,
    `--a:number=[]`,
    `--a:number[]=[""]`,
    `--a:number[]=[true]`,
    `--a:number[]=1`,
    `--a:string=true`,
    `--a:string=1`,
    `--a:string=[]`,
    `--a:string[]=[1]`,
    `--a:string[]=[true]`,
    `--a:string[]=""`,
  ] as const) {
    test("invalid default: " + s, () => {
      const opt = { s } as const;
      expectError(SettingsError, () => getArgs([], opt, options));
    });
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
  const actual = getArgs(cmd.split(/\s+/), opt, options);
  deepStrictEqual(actual, expected);
});

test("flexible syntax", () => {
  const opt = {
    s: `-n , --num : number [ ] = [ 1 , 2 ] bla bla `,
  } as const;
  getArgs([], opt, options);
});

test("string syntax", () => {
  const cmd = "";
  const opt = {
    s: `--s=" "`,
  } as const;
  const expected = {
    targets: [],
    options: { s: " " },
    rest: [],
  };
  const actual = getArgs(cmd.split(/\s+/), opt, options);
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
  const actual = getArgs(cmd.split(/\s+/), opt, options);
  console.log(actual);
});
