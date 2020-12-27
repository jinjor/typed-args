import { deepStrictEqual, fail } from "assert";
import { getArgs, SettingsError, ValidationError } from "../src";

let success = 0;
let error = 0;
process.on("beforeExit", () => {
  console.log();
  console.log("Ran " + (success + error) + " tests.");
  success && console.log("✅ " + success + " succeeded");
  error && console.log("❌ " + error + " failed");
  console.log();
  process.exit(error);
});
function test(name: string, f: Function) {
  try {
    console.log(`testing "${name}" ...`);
    f();
    setTimeout(() => {
      success++;
      console.log("✅ " + name);
    }, 0);
  } catch (e) {
    setTimeout(() => {
      error++;
      console.log("❌ " + name);
      console.log("    " + e.message);
    }, 0);
  }
}
function expectError(errorClass: any, f: Function): void {
  let passed = false;
  try {
    f();
    passed = true;
  } catch (e: any) {
    if (e instanceof errorClass) {
      return;
    }
    fail(
      `expected ${errorClass.name} to be thrown but got another error: ${e.message}`
    );
  }
  if (passed) {
    fail(`expected ${errorClass.name} to be thrown but no error was thrown`);
  }
}

const options = { showHelp: false, exitOnError: false };

test("flexible syntax", () => {
  const opt = {
    a: ` -n , --num : number [ ] = [ 1 , 2 ]; bla bla `,
    b: ` --flag : boolean `,
  } as const;
  const expected = {
    targets: [],
    options: { a: [1, 2], b: false },
    rest: [],
  };
  const actual = getArgs([], opt, options);
  deepStrictEqual(actual, expected);
});

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

test("default value", () => {
  const opt = {
    s: `--a:string="; \\""`,
    sa: `--a:string[]=[ "; \\"" , ",[,]" ]`,
    n: `--a:number=-0.5`,
    na: `--a:number[]=[ -0.5 , -1.0 ]`,
    b: `--a:boolean=true`,
  } as const;
  const expected = {
    targets: [],
    options: {
      s: '; "',
      sa: ['; "', ",[,]"],
      n: -0.5,
      na: [-0.5, -1.0],
      b: true,
    },
    rest: [],
  };
  const actual = getArgs([], opt, options);
  deepStrictEqual(actual, expected);
});

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
    test("invalid default value: " + s, () => {
      const opt = { s } as const;
      expectError(SettingsError, () => getArgs([], opt, options));
    });
  }
}

{
  for (const [s, expectedDefaultValue] of [
    [`--a:string`, null],
    [`--a:string[]`, []],
    [`--a:number`, null],
    [`--a:number[]`, []],
    [`--a:boolean`, false],
  ] as const) {
    test("no default value: " + s, () => {
      const opt = { s } as const;
      const expected = {
        targets: [],
        options: {
          s: expectedDefaultValue,
        },
        rest: [],
      };
      const actual = getArgs([], opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}

{
  for (const s of [
    `--a:boolean!`,
    `--a:number!`,
    `--a:number[]!`,
    `--a:string!`,
    `--a:string[]!`,
  ] as const) {
    test("required value: " + s, () => {
      const opt = { s } as const;
      expectError(ValidationError, () => getArgs([], opt, options));
    });
  }
}
{
  for (const s of [
    `--a:number`,
    `--a:number[]`,
    `--a:string`,
    `--a:string[]`,
  ] as const) {
    test("non-boolean option that has no value: " + s, () => {
      const opt = { s } as const;
      expectError(ValidationError, () => getArgs(["--a"], opt, options));
    });
  }
}

{
  for (const cmd of [`--str=1`, `--str 1`, `-s 1`, `-s1`]) {
    test("string option that has number-like value: " + cmd, () => {
      const opt = { s: "-s,--str:string" } as const;
      const expected = {
        targets: [],
        options: {
          s: "1",
        },
        rest: [],
      };
      const actual = getArgs(cmd.split(/\s+/), opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}
{
  for (const cmd of [
    `--str=1 --str=2`,
    `--str 1 --str 2`,
    `-s 1 -s 2`,
    `-s1 -s2`,
  ]) {
    test("string[] option that has number-like value: " + cmd, () => {
      const opt = { s: "-s,--str:string[]" } as const;
      const expected = {
        targets: [],
        options: {
          s: ["1", "2"],
        },
        rest: [],
      };
      const actual = getArgs(cmd.split(/\s+/), opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}

test("example", () => {
  const cmd = "a b -b 2 --baz2 --flag";
  const opt = {
    a: `--foo:number[]=[42]; hogehoge`,
    b: `-b,--bar:number=42; fugafuga`,
    c: `--baz:string; piyopiyo"`,
    d: `--baz2:string!; piyopiyo(required)`,
    e: `--flag:boolean; a flag`,
  } as const;
  const actual = getArgs(cmd.split(/\s+/), opt, options);
  console.log(actual);
});
