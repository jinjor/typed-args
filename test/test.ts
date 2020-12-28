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
  const expected = { a: [1, 2], b: false };
  const { options: actual } = getArgs([], opt, options);
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

{
  for (const [a, b] of [
    [`--a:boolean`, `--a:string`],
    [`-a,--b:boolean`, `--a:string`],
    [`-a,--b:boolean`, `-a,--c:string`],
  ] as const) {
    test("duplicated options: " + a, () => {
      const opt = { a, b } as const;
      expectError(SettingsError, () => getArgs([], opt, options));
    });
  }
}

{
  for (const [a, expectedValue] of [
    [`--a:string="; \\""`, '; "'],
    [`--a:string[]=[ "; \\"" , ",[,]" ]`, ['; "', ",[,]"]],
    [`--a:number=-0.5`, -0.5],
    [`--a:number[]=[ -0.5 , -1.0 ]`, [-0.5, -1.0]],
    [`--a:boolean=true`, true],
  ] as const) {
    test("default value: " + a, () => {
      const opt = { a } as const;
      const expected = { a: expectedValue };
      const { options: actual } = getArgs([], opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}

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
      const expected = { s: expectedDefaultValue };
      const { options: actual } = getArgs([], opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}

{
  for (const a of [`--a:number!`, `--a:string!`] as const) {
    test("required value: " + a, () => {
      const opt = { a } as const;
      expectError(ValidationError, () => getArgs([], opt, options));
    });
  }
}

{
  for (const a of [`--a:boolean!`, `--a:number[]!`, `--a:string[]!`] as const) {
    test("required types that have non-null defaults: " + a, () => {
      const opt = { a } as const;
      getArgs([], opt, options);
    });
  }
}

test("boolean option that has value", () => {
  const opt = { s: "-a,--foo:boolean" } as const;
  expectError(ValidationError, () => getArgs(["--foo="], opt, options));
});

test("boolean short option that has value", () => {
  const opt = { s: "-a,--foo:boolean" } as const;
  expectError(ValidationError, () => getArgs(["-a1"], opt, options));
});

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
  for (const s of [
    `-a,--foo:number`,
    `-a,--foo:number[]`,
    `-a,--foo:string`,
    `-a,--foo:string[]`,
  ] as const) {
    test("non-boolean short option that has no value: " + s, () => {
      const opt = { s } as const;
      expectError(ValidationError, () => getArgs(["-a"], opt, options));
    });
  }
}

test("empty string", () => {
  const cmd = "--str=";
  const opt = { s: "--str:string" } as const;
  const expected = { s: "" };
  const { options: actual } = getArgs(cmd.split(/\s+/), opt, options);
  deepStrictEqual(actual, expected);
});

test("empty string array", () => {
  const cmd = "--str= --str=";
  const opt = { s: "--str:string[]" } as const;
  const expected = { s: ["", ""] };
  const { options: actual } = getArgs(cmd.split(/\s+/), opt, options);
  deepStrictEqual(actual, expected);
});

{
  for (const cmd of [`--str=1`, `-s 1`, `-s1`]) {
    test("string option that has number-like value: " + cmd, () => {
      const opt = { s: "-s,--str:string" } as const;
      const expected = { s: "1" };
      const { options: actual } = getArgs(cmd.split(/\s+/), opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}

{
  for (const cmd of [`--str=1 --str=2`, `-s 1 -s 2`, `-s1 -s2`]) {
    test("string[] option that has number-like value: " + cmd, () => {
      const opt = { s: "-s,--str:string[]" } as const;
      const expected = { s: ["1", "2"] };
      const { options: actual } = getArgs(cmd.split(/\s+/), opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}

{
  for (const [a, expectedValue] of [
    [`--a:string[]`, ["1"]],
    [`--a:number[]`, [1]],
  ] as const) {
    test("single value for array types: " + a, () => {
      const cmd = "--a=1";
      const opt = { a } as const;
      const expected = { a: expectedValue };
      const { options: actual } = getArgs(cmd.split(/\s+/), opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}

{
  for (const [a, cmd] of [
    // ["--a:boolean", "--a,--a"],
    ["--a:string", "--a=foo --a=bar"],
    ["-a,--aa:string", "-a foo --aa=bar"],
    ["-a,--aa:number", "-a 1,--aa=2"],
  ] as const) {
    test("multiple values for non-array types: " + a, () => {
      const opt = { a } as const;
      expectError(ValidationError, () =>
        getArgs(cmd.split(/\s+/), opt, options)
      );
    });
  }
}

test("example", () => {
  const cmd = "a b -b 2 --baz2=1 --flag";
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
