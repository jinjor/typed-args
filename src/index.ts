import minimist from "minimist";

type Parsed<S> = S extends `${infer Left} ${string}`
  ? ParseTypeWithDefault<Left>
  : ParseTypeWithDefault<S>;
type ParseTypeWithDefault<S> = S extends `${string}:${infer Type}=${string}`
  ? ParseType<Type>
  : S extends `${string}:${infer Type}!`
  ? ParseType<Type>
  : S extends `${string}:${infer Type}`
  ? Optional<ParseType<Type>>
  : never;
type Optional<T> = T extends boolean ? boolean : T | null;
type ParseType<S> = S extends `boolean`
  ? boolean
  : S extends `number[]`
  ? number[]
  : S extends `number`
  ? number
  : S extends `string[]`
  ? string[]
  : S extends `string`
  ? string
  : never;

export class SettingsError extends Error {}
export class ValidationError extends Error {}

function parseType(
  s: string
): {
  short: string | null;
  long: string;
  type: "boolean" | "number[]" | "number" | "string[]" | "string" | "auto";
  required: boolean;
  defaultValue: any;
  description: string;
} {
  const regex = /^(-([a-zA-Z0-9]),)?--([a-zA-Z0-9]+):(boolean|number(\[\])?|string(\[\])?)((!)|=([^ ]*))?( (.*))?$/;
  const result = regex.exec(s);
  if (result == null) {
    throw new Error("Syntax Error: " + s);
  }
  const [
    ,
    ,
    _short,
    _long,
    _type,
    ,
    ,
    ,
    _required,
    _defaultValue,
    ,
    _description,
  ] = result;
  const short = _short ?? null;
  const long = _long;
  let type = null;
  switch (_type) {
    case "boolean":
    case "number[]":
    case "number":
    case "string[]":
    case "string":
      type = _type;
      break;
    default:
      throw new SettingsError("Unknown type: " + _type);
  }
  const required = _required === "!";
  let defaultValue = null;
  if (_defaultValue == null) {
    defaultValue = null;
  } else {
    switch (type) {
      case "boolean": {
        if (_defaultValue == null) {
          defaultValue = false;
        } else if (_defaultValue === "true") {
          defaultValue = true;
        } else if (_defaultValue === "false") {
          defaultValue = false;
        } else {
          throw new SettingsError(
            `The default value of ${long} should be a boolean: ${_defaultValue}`
          );
        }
        break;
      }
      case "number[]": {
        const regex = /^\[(.*)\]$/;
        const result = regex.exec(_defaultValue);
        if (result == null) {
          throw new SettingsError("Syntax Error: " + _defaultValue);
        }
        const [, inner] = result;
        const values = [];
        for (const s of inner.split(",")) {
          const parsed = parseFloat(s);
          if (isNaN(parsed)) {
            throw new SettingsError(
              `The default value of ${long} should be an array of numbers: ${_defaultValue}`
            );
          }
          values.push(parsed);
        }
        defaultValue = values;
        break;
      }
      case "number": {
        if (_defaultValue == null) {
          defaultValue = null;
        } else {
          const parsed = parseFloat(_defaultValue);
          if (isNaN(parsed)) {
            throw new SettingsError(
              `The default value of ${long} should be a number: ${_defaultValue}`
            );
          }
          defaultValue = parsed;
        }
        break;
      }
      case "string[]": {
        const regex = /^\[(.*)\]$/;
        const result = regex.exec(_defaultValue);
        if (result == null) {
          throw new SettingsError("Syntax Error: " + _defaultValue);
        }
        const [, inner] = result;
        const values = [] as string[];
        for (const s of inner.split(",")) {
          let json = null;
          try {
            json = JSON.parse(s);
          } catch (e) {
            throw new SettingsError(
              `The default value of ${long} should be an array of string: ${_defaultValue}`
            );
          }
          if (typeof json !== "string") {
            throw new SettingsError(
              `The default value of ${long} should be an array of string: ${_defaultValue}`
            );
          }
          values.push(json);
        }
        defaultValue = values;
        break;
      }
      case "string": {
        if (_defaultValue == null) {
          defaultValue = null;
        } else {
          let json = null;
          try {
            json = JSON.parse(_defaultValue);
          } catch (e) {
            throw new SettingsError(
              `The default value of ${long} should be a string: ${_defaultValue}`
            );
          }
          if (typeof json !== "string") {
            throw new SettingsError(
              `The default value of ${long} should be a string: ${_defaultValue}`
            );
          }
          defaultValue = json;
        }
        break;
      }
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
  types: T,
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

  for (const key in types) {
    const t = parseType(types[key]);
    const { short, long, type, defaultValue } = t;
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
    for (const key in types) {
      const t = parseType(types[key]);
      const { long, type, required } = t;
      let value = parsed[long];
      if (value == null) {
        if (required) {
          throw new ValidationError(long + " is required");
        }
        value = null;
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
        for (const key in types) {
          const t = parseType(types[key]);
          const { description } = t;
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
