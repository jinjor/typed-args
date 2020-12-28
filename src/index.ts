import { assert } from "console";
import minimist from "minimist";

type Parsed<S> = S extends `${string}:${infer Type}`
  ? ParseFromType<Type>
  : never;
type Optional<T> = T extends boolean ? boolean : T | null;
type ParseAfterType<T, S> = S extends ` ${infer Rest}`
  ? ParseAfterType<T, Rest>
  : S extends `=${string}`
  ? T
  : S extends `!${string}`
  ? T
  : Optional<T>;
type ParseFromType<S> = S extends ` ${infer Rest}`
  ? ParseFromType<Rest>
  : S extends `boolean${infer Next}`
  ? ParseAfterType<boolean, Next>
  : S extends `number[]${infer Next}`
  ? ParseAfterType<number[], Next>
  : S extends `number${infer Next}`
  ? ParseAfterType<number, Next>
  : S extends `string[]${infer Next}`
  ? ParseAfterType<string[], Next>
  : S extends `string${infer Next}`
  ? ParseAfterType<string, Next>
  : never;

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
type ParsedDefinitions = {
  [key: string]: ParsedDefinition;
};
function parseDefinitions(types: { [key: string]: string }): ParsedDefinitions {
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

export function getArgs<T extends Record<string, string>>(
  args: string[],
  definitions: T,
  options?: { showHelp?: boolean; exitOnError?: boolean }
): {
  targets: string[];
  options: {
    [K in keyof T]: Parsed<T[K]>;
  };
  rest: string[];
} {
  const { showHelp, exitOnError } = {
    showHelp: true,
    exitOnError: true,
    ...options,
  };
  const minimistOptions = {
    string: [] as string[],
    boolean: true,
    default: {} as Record<string, string>,
    alias: {} as Record<string, string>,
    "--": true,
  };
  const defs = parseDefinitions(definitions);

  for (const key in defs) {
    const { short, long, type, defaultValue } = defs[key];
    if (short != null) {
      minimistOptions.alias[long] = short;
    }
    if (type === "string" || type === "string[]") {
      minimistOptions.string.push(long);
    }
    if (defaultValue != null) {
      minimistOptions.default[long] = defaultValue;
    }
  }
  const parsed = minimist(args, minimistOptions);
  const targets = parsed._;
  const rest = parsed["--"]!;
  const validatedOptions = {} as Record<string, any>;
  try {
    for (const key in defs) {
      const { long, type, required } = defs[key];
      let value = parsed[long];
      if (value == null) {
        if (required) {
          throw new ValidationError(long + " is required");
        }
        value = null;
      } else if (type === "boolean") {
        if (Array.isArray(value)) {
          throw new ValidationError(long + " should not have multiple values");
        }
        if (typeof value !== "boolean") {
          throw new ValidationError(long + " should be a boolean");
        }
      } else if (type === "number") {
        if (Array.isArray(value)) {
          throw new ValidationError(long + " should not have multiple values");
        }
        if (typeof value !== "number") {
          throw new ValidationError(long + " should be a number");
        }
      } else if (type === "number[]") {
        const values = Array.isArray(value) ? value : [value];
        value = values;
        for (const v of values) {
          if (typeof v !== "number") {
            throw new ValidationError(
              "All value of " + long + " should be a number"
            );
          }
        }
      } else if (type === "string") {
        if (Array.isArray(value)) {
          throw new ValidationError(long + " should not have multiple values");
        }
        if (typeof value !== "string") {
          throw new ValidationError(long + " should be a string");
        }
      } else if (type === "string[]") {
        const values = Array.isArray(value) ? value : [value];
        value = values;
        for (const v of values) {
          if (typeof v !== "string") {
            throw new ValidationError(
              "All value of " + long + " should be a string"
            );
          }
        }
      }
      validatedOptions[key] = value;
    }
  } catch (e) {
    if (e instanceof ValidationError) {
      if (showHelp) {
        for (const key in defs) {
          const { description } = defs[key];
          console.error(description);
        }
      }
      if (exitOnError) {
        process.exit(1);
      }
    }
    throw e;
  }
  return {
    targets,
    rest,
    options: validatedOptions as any,
  };
}
