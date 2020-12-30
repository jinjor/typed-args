import assert, { deepStrictEqual, fail, strictEqual } from "assert";
import { parseArgs, SettingsError, ValidationError } from "../src";
import { spawnSync } from "child_process";

let success = 0;
let error = 0;
process.on("beforeExit", () => {
  console.log();
  console.log("Ran " + (success + error) + " tests.");
  success && console.log("✅ " + success + " passed");
  error && console.log("❌ " + error + " failed");
  console.log();
  process.exit(error);
});
function test(name: string, f: Function) {
  try {
    console.log(`🔹 testing "${name}" ...`);
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
function expectError(errorClass: any, f: Function): string {
  let result = null;
  try {
    result = f();
  } catch (e: any) {
    if (e instanceof errorClass) {
      return e.message;
    }
    fail(
      `expected ${errorClass.name} to be thrown but got another error: ${e.message}`
    );
  }
  const json = JSON.stringify(result);
  fail(
    `expected ${errorClass.name} to be thrown but no error was thrown: ${json}`
  );
}
function assertMatches(regex: RegExp, s: string): void {
  assert(regex.test(s), `${regex} does not match \`${s}\``);
}

const options = { exitOnError: false };

test("flexible syntax", () => {
  const opt = {
    a: ` -n , --num : number [ ] = [ 1 , 2 ]; bla bla `,
    b: ` --flag : boolean `,
  } as const;
  const expected = { a: [1, 2], b: false };
  const { options: actual } = parseArgs([], opt, options);
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
  const { help, ...actual } = parseArgs(cmd.split(/\s+/), opt, options);
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
      expectError(SettingsError, () => parseArgs([], opt, options));
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
      const { options: actual } = parseArgs([], opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}

{
  for (const s of [
    `--a:boolean=1`,
    `--a:boolean=0`,
    `--a:boolean=""`,
    `--a:boolean=null`,
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
      expectError(SettingsError, () => parseArgs([], opt, options));
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
      const { options: actual } = parseArgs([], opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}

{
  for (const a of [`-a,--foo:number!`, `-a,--foo:string!`] as const) {
    test("required value: " + a, () => {
      const opt = { a } as const;
      const message = expectError(ValidationError, () =>
        parseArgs([], opt, options)
      );
      assertMatches(/-a/, message);
      assertMatches(/--foo/, message);
      assertMatches(/required/, message);
    });
  }
}

{
  for (const [a, cmd] of [
    [`-a,--foo:number`, `-a a`],
    [`-a,--foo:number`, `-a`],
    [`-a,--foo:string`, `-a`],
  ] as const) {
    test("type mismatch by short options: " + a, () => {
      const opt = { a } as const;
      const message = expectError(ValidationError, () =>
        parseArgs(cmd.split(/\s+/), opt, options)
      );
      assertMatches(/-a/, message);
      assertMatches(/should/, message);
    });
  }
}

{
  for (const [a, cmd] of [
    [`-a,--foo:number`, `--foo a`],
    [`-a,--foo:number`, `--foo=a`],
    [`-a,--foo:number`, `--foo`],
    [`-a,--foo:string`, `--foo`],
  ] as const) {
    test("type mismatch by long options: " + a, () => {
      const opt = { a } as const;
      const message = expectError(ValidationError, () =>
        parseArgs(cmd.split(/\s+/), opt, options)
      );
      assertMatches(/--foo/, message);
      assertMatches(/should/, message);
    });
  }
}

{
  for (const a of [`--a:boolean!`, `--a:number[]!`, `--a:string[]!`] as const) {
    test("required types that have non-null defaults: " + a, () => {
      const opt = { a } as const;
      parseArgs([], opt, options);
    });
  }
}

test("boolean option that has value", () => {
  const opt = { s: "-a,--foo:boolean" } as const;
  const message = expectError(ValidationError, () =>
    parseArgs(["--foo=x"], opt, options)
  );
  assertMatches(/--foo/, message);
  assertMatches(/boolean/, message);
});

test(`boolean option that has value after "--"`, () => {
  const opt = { s: "-a,--foo:boolean" } as const;
  parseArgs(["--", "--foo=x"], opt, options);
});

test("boolean short option that has value", () => {
  const opt = { s: "-a,--foo:boolean" } as const;
  const message = expectError(ValidationError, () =>
    parseArgs(["-a1"], opt, options)
  );
  assertMatches(/-a/, message);
  assertMatches(/boolean/, message);
});

{
  for (const [a, cmd, expetedTargets, expectedOption] of [
    ["--a:boolean", "--a foo", ["foo"], true],
    ["-a,--foo:boolean", "-a foo", ["foo"], true],
    ["--a:string", "--a foo", [], "foo"],
    ["-a,--foo:string", "-a foo", [], "foo"],
  ] as const) {
    test(
      "different behaviors between boolean and others: " + a + " | " + cmd,
      () => {
        const opt = { a } as const;
        const expectedOptions = { a: expectedOption };
        const result = parseArgs(cmd.split(/\s+/), opt, options);
        deepStrictEqual(result.targets, expetedTargets);
        deepStrictEqual(result.options, expectedOptions);
      }
    );
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
      const message = expectError(ValidationError, () =>
        parseArgs(["--a"], opt, options)
      );
      assertMatches(/--a/, message);
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
      const message = expectError(ValidationError, () =>
        parseArgs(["-a"], opt, options)
      );
      assertMatches(/-a/, message);
    });
  }
}

test("empty string", () => {
  const cmd = "--str=";
  const opt = { s: "--str:string" } as const;
  const expected = { s: "" };
  const { options: actual } = parseArgs(cmd.split(/\s+/), opt, options);
  deepStrictEqual(actual, expected);
});

test("empty string array", () => {
  const cmd = "--str= --str=";
  const opt = { s: "--str:string[]" } as const;
  const expected = { s: ["", ""] };
  const { options: actual } = parseArgs(cmd.split(/\s+/), opt, options);
  deepStrictEqual(actual, expected);
});

{
  for (const cmd of [`--str=1`, `-s 1`, `-s1`]) {
    test("string option that has number-like value: " + cmd, () => {
      const opt = { s: "-s,--str:string" } as const;
      const expected = { s: "1" };
      const { options: actual } = parseArgs(cmd.split(/\s+/), opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}

{
  for (const cmd of [`--str=1 --str=2`, `-s 1 -s 2`, `-s1 -s2`]) {
    test("string[] option that has number-like value: " + cmd, () => {
      const opt = { s: "-s,--str:string[]" } as const;
      const expected = { s: ["1", "2"] };
      const { options: actual } = parseArgs(cmd.split(/\s+/), opt, options);
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
      const { options: actual } = parseArgs(cmd.split(/\s+/), opt, options);
      deepStrictEqual(actual, expected);
    });
  }
}

{
  for (const [a, cmd] of [
    // ["--a:boolean", "--a --a"],
    ["--a:string", "--a=foo --a=bar"],
    ["-a,--aa:string", "-a foo --aa=bar"],
    ["-a,--aa:number", "-a 1 --aa=2"],
  ] as const) {
    test("multiple values for non-array types: " + a, () => {
      const opt = { a } as const;
      const message = expectError(ValidationError, () =>
        parseArgs(cmd.split(/\s+/), opt, options)
      );
      assertMatches(/-a/, message);
      assertMatches(/multiple/, message);
    });
  }
}

{
  for (const [a, cmd] of [
    ["-a,--foo:number[]", "--a=1 --foo=2"],
    ["-a,--foo:string[]", "-a x --foo=y"],
  ] as const) {
    test("take both short and long: " + a, () => {
      const opt = { a } as const;
      parseArgs(cmd.split(/\s+/), opt, options);
    });
  }
}

{
  for (const [a, cmd] of [
    ["-a,--foo:number", "--a=1 --foo=2"],
    ["-a,--foo:number[]", "--a=x --foo=2"],
    ["-a,--foo:number[]", "--a=1 --foo=y"],
    ["-a,--foo:number[]", "--a=x --foo=y"],
    ["-a,--foo:string", "-a x --foo=y"],
    ["-a,--foo:string[]", "--a=x --foo"],
    ["-a,--foo:string[]", "--a --foo=y"],
    ["-a,--foo:string[]", "--a --foo"],
  ] as const) {
    test("take both short and long (invalid): " + a, () => {
      const opt = { a } as const;
      expectError(ValidationError, () =>
        parseArgs(cmd.split(/\s+/), opt, options)
      );
    });
  }
}

{
  for (const cmd of ["-a", "-a1", "-a 1", "--aa", "--aa=", "--aa=1"] as const) {
    test("unknown options: " + cmd, () => {
      const opt = {} as const;
      const message = expectError(ValidationError, () =>
        parseArgs(cmd.split(/\s+/), opt, options)
      );
      assertMatches(/-a/, message);
      assertMatches(/unknown/i, message);
    });
  }
}

{
  for (const args of [[], ["--a"], ["--", "a"]]) {
    test("`requireTarget` option: " + JSON.stringify(args), () => {
      const opt = { a: "--a:boolean" } as const;
      const expectedMessage = "target not found";
      const message = expectError(ValidationError, () =>
        parseArgs(args, opt, { ...options, requireTarget: expectedMessage })
      );
      assertMatches(new RegExp(expectedMessage), message);
    });
  }
}

function example(
  args: string
): { status: number | null; stdout: string; stderr: string } {
  const path = "dist/test/example";
  return spawnSync("node", [path, ...args.split(/\s+/)], {
    encoding: "utf8",
  });
}

test("example", () => {
  const { status, stdout } = example("-p 3001 --cors");
  strictEqual(status, 0);
  strictEqual(stdout.trim(), "3001 0.0.0.0 true");
});

test("example: --help", () => {
  const { status, stdout } = example("--help");
  strictEqual(status, 0);
  process.stdout.write(stdout);
});

test("example: invalid", () => {
  const { status, stderr } = example("--unknown");
  strictEqual(status, 1);
  process.stdout.write(stderr);
});

{
  function assertType<T>(t: T): T {
    return t;
  }
  const opt = {
    b1: `--num:boolean`,
    b2: `--num:boolean=true`,
    b3: `--num:boolean!`,
    n1: `--num:number`,
    n2: `--num:number=1`,
    n3: `--num:number!`,
    na1: `--num:number[]`,
    na2: `--num:number[]=[]`,
    na3: `--num:number[]!`,
    s1: `--num:string`,
    s2: `--num:string=""`,
    s3: `--num:string!`,
    sa1: `--num:string[]`,
    sa2: `--num:string[]=[]`,
    sa3: `--num:string[]!`,
  } as const;
  let {
    options: {
      b1,
      b2,
      b3,
      n1,
      n2,
      n3,
      na1,
      na2,
      na3,
      s1,
      s2,
      s3,
      sa1,
      sa2,
      sa3,
    },
  } = parseArgs([], opt, options);
  b1 = assertType<boolean>(b1);
  b2 = assertType<boolean>(b2);
  b3 = assertType<boolean>(b3);
  n1 = assertType<number | null>(n1);
  n2 = assertType<number>(n2);
  n3 = assertType<number>(n3);
  na1 = assertType<number[]>(na1);
  na2 = assertType<number[]>(na2);
  na3 = assertType<number[]>(na3);
  s1 = assertType<string | null>(s1);
  s2 = assertType<string>(s2);
  s3 = assertType<string>(s3);
  sa1 = assertType<string[]>(sa1);
  sa2 = assertType<string[]>(sa2);
  sa3 = assertType<string[]>(sa3);
}
