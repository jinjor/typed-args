import { assert } from "console";
import minimist from "minimist";

type Parse<S> = S extends `${string}:${infer Type}`
  ? ParseFromType<Type>
  : never;
type ParseFromType<S> = S extends ` ${infer Rest}`
  ? ParseFromType<Rest>
  : S extends `boolean${infer Next}`
  ? boolean
  : S extends `number[]${infer Next}`
  ? number[]
  : S extends `number${infer Next}`
  ? ParseAfterType<number, Next>
  : S extends `string[]${infer Next}`
  ? string[]
  : S extends `string${infer Next}`
  ? ParseAfterType<string, Next>
  : never;
type ParseAfterType<T, S> = S extends ` ${infer Rest}`
  ? ParseAfterType<T, Rest>
  : S extends `=${string}`
  ? T
  : S extends `!${string}`
  ? T
  : Optional<T>;
type Optional<T> = T extends boolean ? boolean : T | null;

export class SettingsError extends Error {}
export class ValidationError extends Error {}

type Type = "boolean" | "number[]" | "number" | "string[]" | "string";

function parseDefaultValue(long: string, defaultValue: string): any {
  try {
    return JSON.parse(defaultValue);
  } catch (e) {
    throw new SettingsError(
      `Could not parse default value of ${long}: ${defaultValue}`
    );
  }
}
function typeMismatchOfDefaultValue(
  long: string,
  type: Type,
  defaultValue: string
): never {
  const what =
    type === "boolean"
      ? "a boolean"
      : type === "number"
      ? "a number"
      : type === "number[]"
      ? "an array of number"
      : type === "string"
      ? "a string"
      : type === "string[]"
      ? "an array of string"
      : null;
  assert(what !== null);
  throw new SettingsError(
    `The default value of ${long} should be ${what}: ${defaultValue}`
  );
}
type ParsedDefinition = {
  short: string | null;
  long: string;
  type: Type;
  required: boolean;
  defaultValue: any;
  description: string;
};
type ParsedDefinitions = Record<string, ParsedDefinition>;
function parseDefinitions(types: Record<string, string>): ParsedDefinitions {
  const result: ParsedDefinitions = {};
  const keys: Set<string> = new Set();
  const dups: string[] = [];
  for (const key in types) {
    const t = parseDefinition(types[key]);
    if (t.short != null) {
      if (keys.has(t.short)) {
        dups.push(t.short);
      }
      keys.add(t.short);
    }
    if (keys.has(t.long)) {
      dups.push(t.long);
    }
    keys.add(t.long);
    result[key] = t;
  }
  if (dups.length > 0) {
    throw new SettingsError("Duplicated keys found: " + dups.join(", "));
  }
  return result;
}
function defaultValueOf(type: Type): any {
  switch (type) {
    case "boolean":
      return false;
    case "number[]":
      return [];
    case "number":
      return null;
    case "string[]":
      return [];
    case "string":
      return null;
  }
}
function isDefaultValueCorrectType(type: Type, json: any): boolean {
  switch (type) {
    case "boolean": {
      if (typeof json !== "boolean") {
        return false;
      }
      return true;
    }
    case "number[]": {
      if (!Array.isArray(json)) {
        return false;
      }
      for (const item of json) {
        if (typeof item !== "number") {
          return false;
        }
      }
      return true;
    }
    case "number": {
      if (typeof json !== "number") {
        return false;
      }
      return true;
    }
    case "string[]": {
      if (!Array.isArray(json)) {
        return false;
      }
      for (const item of json) {
        if (typeof item !== "string") {
          return false;
        }
      }
      return true;
    }
    case "string": {
      if (typeof json !== "string") {
        return false;
      }
      return true;
    }
  }
}
const definitionRegex = new RegExp(
  [
    // short
    /^(?:\s*-([a-zA-Z0-9])\s*,)?/,
    // long
    /\s*--([a-zA-Z0-9]+)/,
    // type
    /\s*:\s*(boolean|number(?:\s*\[\s*\])?|string(?:\s*\[\s*\])?)/,
    // required or default
    /(?:\s*(!)|\s*=\s*((?:[^;"]*(?:"(?:[^"\\]|\\.)*")?)*))?/,
    // description
    /\s*(?:;\s*(.*))?$/,
  ]
    .map((r) => r.source)
    .join("")
);
function parseDefinition(s: string): ParsedDefinition {
  const result = definitionRegex.exec(s);
  if (result == null) {
    throw new Error("Syntax Error: " + s);
  }
  const [
    ,
    _short,
    _long,
    _type,
    _required,
    _defaultValue,
    _description,
  ] = result;
  const short = _short ?? null;
  const long = _long;
  const __type = _type.replace(/\s+/g, "");
  let type = null;
  switch (__type) {
    case "boolean":
    case "number[]":
    case "number":
    case "string[]":
    case "string":
      type = __type;
      break;
    default:
      throw new SettingsError("Unknown type: " + _type);
  }
  const required = _required === "!";
  let defaultValue = defaultValueOf(type);
  if (_defaultValue != null) {
    defaultValue = parseDefaultValue(long, _defaultValue);
    if (!isDefaultValueCorrectType(type, defaultValue)) {
      typeMismatchOfDefaultValue(long, type, _defaultValue);
    }
  }
  const description = _description ?? "";
  return {
    short,
    long,
    type,
    required,
    defaultValue,
    description,
  };
}

function collectValues(longValue: any, shortValue: any) {
  longValue ??= null;
  shortValue ??= null;
  if (longValue == null) {
    return shortValue;
  }
  if (shortValue == null) {
    return longValue;
  }
  if (!Array.isArray(longValue)) {
    longValue = [longValue];
  }
  if (!Array.isArray(shortValue)) {
    shortValue = [shortValue];
  }
  return [...longValue, ...shortValue];
}

function validate(
  args: string[],
  parsed: Record<string, any>,
  defs: ParsedDefinitions,
  requireTarget: string | boolean
): { targets: string[]; options: any; rest: string[] } {
  const targets = parsed._;
  const rest = parsed["--"]!;
  if (requireTarget && targets.length === 0) {
    if (typeof requireTarget === "string") {
      throw new ValidationError(requireTarget);
    } else {
      throw new ValidationError();
    }
  }
  const result = {} as Record<string, any>;
  const longToType = new Map<string, Type>();
  const shortToType = new Map<string, Type>();
  for (const key in defs) {
    const { short, long, type, required, defaultValue } = defs[key];
    longToType.set(long, type);
    if (short != null) {
      shortToType.set(short, type);
    }
    if (type === "boolean") {
      if (short != null && parsed[short] === false) {
        parsed[short] = null;
      }
      if (parsed[long] === false) {
        parsed[long] = null;
      }
    }
    const shortValue = short != null ? parsed[short] : null;
    const longValue = parsed[long];
    let value = collectValues(longValue, shortValue);
    const shortName = short != null ? `-${short}` : null;
    const longName = `--${long}`;
    const foundName = longValue != null ? longName : shortName;
    if (value == null) {
      value = defaultValue;
    }
    if (value == null) {
      if (required) {
        const n = `${shortName != null ? shortName + " or " : ""}${longName}`;
        throw new ValidationError(`${n} is required`);
      }
    } else if (type === "boolean") {
      if (Array.isArray(value)) {
        throw new ValidationError(
          `${foundName} should not have multiple values`
        );
      }
      if (typeof value !== "boolean") {
        throw new ValidationError(`${foundName} should be a boolean`);
      }
    } else if (type === "number") {
      if (Array.isArray(value)) {
        throw new ValidationError(
          `${foundName} should not have multiple values`
        );
      }
      if (typeof value !== "number") {
        throw new ValidationError(`${foundName} should be a number`);
      }
    } else if (type === "number[]") {
      value = Array.isArray(value) ? value : [value];
      for (const v of value) {
        if (typeof v !== "number") {
          throw new ValidationError(
            "All value of " + `${foundName} should be a number`
          );
        }
      }
    } else if (type === "string") {
      if (Array.isArray(value)) {
        throw new ValidationError(
          `${foundName} should not have multiple values`
        );
      }
      if (typeof value !== "string") {
        if (typeof value === "number") {
          value = String(value);
        } else {
          throw new ValidationError(`${foundName} should be a string`);
        }
      }
    } else if (type === "string[]") {
      value = Array.isArray(value) ? value : [value];
      for (let i = 0; i < value.length; i++) {
        const v = value[i];
        if (typeof v !== "string") {
          if (typeof v === "number") {
            value[i] = String(v);
          } else {
            throw new ValidationError(
              `All value of ${foundName} should be a string`
            );
          }
        }
      }
    }
    result[key] = value;
  }
  for (const arg of args) {
    if (arg === "--") {
      break;
    }
    const matched = /^--([^=]+)=.*$/.exec(arg);
    if (matched) {
      const [, k] = matched;
      if (longToType.get(k) === "boolean") {
        throw new ValidationError(`--${k} should be a boolean`);
      }
    }
  }
  for (const key in parsed) {
    if (
      key !== "_" &&
      key !== "--" &&
      !longToType.has(key) &&
      !shortToType.has(key)
    ) {
      let name!: string;
      for (const arg of args) {
        if (new RegExp(`^--${key}`).test(arg)) {
          name = `--${key}`;
          break;
        } else if (new RegExp(`^-${key}`).test(arg)) {
          name = `-${key}`;
          break;
        }
      }
      throw new ValidationError(`unknown option: ${name}`);
    }
  }
  return {
    targets,
    options: result as any,
    rest,
  };
}

function makeHelp(usage: string | null, defs: ParsedDefinitions) {
  let s = usage ? `Usage: ${usage}\n` : "";
  let maxLength = 0;
  const info: [string, string][] = [];
  for (const key in defs) {
    const d = defs[key];
    const short = d.short ? `-${d.short}, ` : "";
    const type = d.type === "boolean" ? "" : ` <${d.type.replace("[]", "")}>`;
    const long = `--${d.long}`;
    const left = `${short}${long}${type}`;
    const extra = d.required
      ? ` (required)`
      : d.defaultValue != null &&
        JSON.stringify(d.defaultValue) !==
          JSON.stringify(defaultValueOf(d.type))
      ? ` (default:${JSON.stringify(d.defaultValue)})`
      : "";
    const right = `${d.description}${extra}`;
    info.push([left, right]);
    maxLength = Math.max(left.length, maxLength);
  }
  if (info.length > 0) {
    s += "Options:\n";
  }
  for (const [left, description] of info) {
    s += `  ${left.padEnd(maxLength)} ${description}\n`;
  }
  return s;
}

type Help<T extends number | null> = (
  exit: T
) => T extends number ? never : string;
export function parseArgs<T extends Record<string, string>>(
  args: string[],
  definitions: T,
  options?: {
    usage?: string;
    exitOnError?: boolean;
    handleHelp?: boolean;
    requireTarget?: string | boolean;
  }
): {
  targets: string[];
  options: {
    [K in keyof T]: Parse<T[K]>;
  };
  rest: string[];
  help: Help<number | null>;
} {
  const { usage, exitOnError, handleHelp, requireTarget } = {
    usage: null,
    exitOnError: true,
    handleHelp: true,
    requireTarget: false,
    ...options,
  };
  const minimistOptions = {
    boolean: [] as string[],
    "--": true,
  };
  const defs = parseDefinitions(definitions);
  for (const key in defs) {
    const { short, long, type } = defs[key];
    if (type === "boolean") {
      if (short != null) {
        minimistOptions.boolean.push(short);
      }
      minimistOptions.boolean.push(long);
    }
  }
  const parsed = minimist(args, minimistOptions);
  const help = (exit: number | null) => {
    const s = makeHelp(usage, defs);
    if (exit != null) {
      exit === 0 ? console.log(s) : console.error(s);
      process.exit(exit);
    }
    return s;
  };
  try {
    const validated = validate(args, parsed, defs, requireTarget);
    if (handleHelp && validated.options.help === true) {
      help(0);
    }
    return { ...validated, help };
  } catch (e) {
    if (e instanceof ValidationError) {
      if (exitOnError) {
        if (e.message) {
          console.error("Error: " + e.message);
        }
        help(1);
      }
    }
    throw e;
  }
}
