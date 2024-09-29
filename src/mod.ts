/** A compound helper type that removes all `Omits` from `T` and makes all keys from `Optional` optional in `T` */
type Selective<
  T extends { [k: string]: unknown },
  Optionals extends keyof T,
  Omits extends keyof T
> = Omit<T, Omits | Optionals> & Partial<Pick<T, Optionals>>;

/** The attributes shared by all flags */
type BaseFlag = {
  description: string;
};
/** A flag that can be set to true or false */
export type BooleanFlag = BaseFlag & {
  type: "boolean";
  short?: string;
};
/** A flag that can be set to a specific value */
export type ValueFlag = BaseFlag & {
  type: "value";
  required?: boolean;
  /** The values this flag accepts. If omitted, accepts anything */
  only?: RegExp | string[];
};
/** All different types of flags */
export type Flag = BooleanFlag | ValueFlag;
/** Flags that are handled by the package */
type InvalidFlags = "force" | "help";
/**
 * A record of flags for a command excluding flags that are handled by the package
 *
 * `force` — create the command with `dangerous` set to true instead. This will ask the user to confirm if --force is not specified
 * `help` — this is automatically handled via the `description` fields on Commands and Flags
 */
export type ValidFlags = { [key: string]: Flag } & {
  [key in InvalidFlags]?: never;
};
/** A helper type for the `FlagReturn` */
type RequiredReturn<Required extends boolean | void, T> = Required extends true
  ? T
  : T | undefined;
/** A helper type for the `FlagsReturn` */
type FlagReturn<T extends Flag> = T extends ValueFlag
  ? RequiredReturn<T["required"], T["only"] extends Array<infer R> ? R : string>
  : boolean;
/** Infers the TS ReturnType that a flag will create */
export type FlagsReturn<T extends ValidFlags> = {
  [key in Exclude<keyof T, InvalidFlags>]: FlagReturn<T[key]>;
};

export type Runner<Flags extends ValidFlags> = (
  args: string[],
  flags: Flags extends ValidFlags
    ? { [key in Exclude<keyof Flags, InvalidFlags>]: FlagReturn<Flags[key]> }
    : void
) => unknown;

export type ArgumentList = string[];

type BaseCommand = {
  description: string;
};
export type Executable<Flags extends ValidFlags> = BaseCommand & {
  run: Runner<Flags>;
  dangerous: boolean;
  arguments?: ArgumentList | ArgumentList[];
  flags?: Flags;
  /** An example on how to use the command */
  example?: string;
};
export type Parent = BaseCommand & {
  children: CommandMap;
};
export type Command<Flags extends ValidFlags> = Parent | Executable<Flags>;

// deno-lint-ignore no-explicit-any
export type CommandMap = { [key: string]: Command<any> };

/** The ReturnType of the {@link create} function */
export type CLI = { run: (args?: string[]) => unknown };

const abort = (message: string) => {
  console.error(message);
  Deno.exit(1);
};

const invalidCommandString = (
  commandName: string | undefined,
  path: string[]
): string => {
  if (!path.length) {
    const runInstruction = 'Run "--help" to get a list of valid commands.';
    if (commandName === undefined)
      return "No command specified. " + runInstruction;
    else return `The command "${commandName}" doesn't exist. ${runInstruction}`;
  } else {
    const pathName = path.join(" ");
    const runInstruction = `Run "${pathName} --help" to get a list of valid subcommands.`;
    if (commandName === undefined)
      return "No subcommand specified. " + runInstruction;
    else
      return `The subcommand "${commandName}" doesn't exist. ${runInstruction}`;
  }
};

const createTable = (
  columns: number
): {
  push: (...items: string[]) => { push: (str: string) => void };
  build: (...joins: string[]) => string[];
} => {
  const rows: string[][] = [];
  const maxSizes = Array(columns).fill(0);

  const push = (...items: string[]) => {
    const row = Array(columns);
    rows.push(row);

    let currentIndex = 0;

    const push = (str: string) => {
      maxSizes[currentIndex] = Math.max(maxSizes[currentIndex], str.length);
      row[currentIndex++] = str;
    };

    items.forEach(push);

    return { push };
  };

  const build = (...joins: string[]): string[] => {
    const lines: string[] = Array(rows.length).fill(joins[0] || "");
    if (joins.length < columns + 1)
      joins.push(...Array(columns - joins.length).fill(" "), "");

    for (let j = 0; j < rows.length; ++j) {
      const row = rows[j];
      const rowLen = row.length;
      for (let i = 0; i < rowLen; ++i) {
        const maxSize = maxSizes[i];
        const isLast = i === rowLen - 1;
        if (isLast && !joins[i + 1]) lines[j] += row[i];
        else {
          const padded = row[i].padEnd(maxSize);
          lines[j] += padded + joins[i + 1];
        }
      }
    }
    return lines;
  };

  return { push, build };
};

const logHelp = (command: Command<ValidFlags>, path: string[]) => {
  const type = "run" in command ? "command" : "group";
  const helpText = [
    ...(path.length ? [`Help for ${type} "${path.join("/")}":`, ""] : []),
    "Description:",
    command.description,
  ];

  if ("run" in command) {
    if (command.arguments) {
      helpText.push("\nArguments:");
      const argLists = command.arguments;
      const lists = (
        argLists[0] && Array.isArray(argLists[0]) ? argLists : [argLists]
      ) as ArgumentList[];
      for (const list of lists) helpText.push("\t" + list.join(" "));
    } else helpText.push("\nArguments: NONE");
    if (command.flags) {
      helpText.push("\nFlags:");
      const table = createTable(3);
      for (const flagName in command.flags) {
        const row = table.push();

        const flag = command.flags[flagName];
        if (flag.type === "boolean") {
          row.push(flagName);
          row.push("bool");
        } else {
          if (flag.required) row.push(flagName + "*");
          else row.push(flagName);

          if (!flag.only) row.push("string");
          else if (Array.isArray(flag.only))
            row.push(flag.only.map((v) => `"${v}"`).join("/"));
          else row.push(flag.only.toString());
        }
        row.push(flag.description);
      }
      helpText.push(...table.build("\t", " | ", ": "));
    } else helpText.push("\nFlags: NONE");

    if (command.example) {
      helpText.push("\nExample:");
      helpText.push(command.example);
    }
  } else {
    helpText.push("\nSubcommands:\n");
    const table = createTable(3);
    for (const subcommandName in command.children) {
      const subcommand = command.children[subcommandName];
      const type = "run" in subcommand ? "command" : "group";
      table.push(subcommandName, type, subcommand.description);
    }
    helpText.push(...table.build("\t", " | ", ": "));
  }
  console.log(helpText.join("\n"));
};

const parseArgs = <T extends Executable<ValidFlags>>(
  args: string[],
  command: T
): [args: string[], flags: FlagsReturn<ValidFlags>] => {
  /** The text to prefix to the second error message sentence */
  const errorHelpText = 'Run command with "--help" for';
  const expectedFlags = command.flags || {};

  const shortFlagMap: Record<string, string> = {};
  const requiredFlags = new Set<string>();

  type ReturnFlags = FlagsReturn<typeof expectedFlags>;
  const resultFlags: Partial<ReturnFlags> = {};
  const resultArgs: string[] = [];

  for (const [name, flag] of Object.entries(expectedFlags)) {
    if (flag.type === "boolean")
      resultFlags[name as keyof ReturnFlags] = false as ReturnFlags[string];
    if (flag.type === "boolean" && flag.short) shortFlagMap[flag.short] = name;
    if (flag.type === "value" && flag.required) requiredFlags.add(name);
  }

  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const flagString = arg.substring(2);

      // Remove value if assigned in flagName
      const equalsIndex = flagString.indexOf("=");
      const flagName =
        equalsIndex === -1 ? flagString : flagString.substring(0, equalsIndex);

      // Ignore force flags during parsing as handled by package
      if (flagName === "force" && command.dangerous) continue;

      const flag = expectedFlags[flagName];
      if (!flag)
        abort(
          `Unknown flag "${flagName}" specified. ${errorHelpText} a list of valid flags.`
        );
      if (flag.type === "boolean")
        resultFlags[flagName as keyof ReturnFlags] =
          true as ReturnFlags[string];
      else {
        let value: string;
        if (equalsIndex !== -1) value = flagString.substring(equalsIndex + 1);
        else {
          const nextArg = args[++i];
          if (!nextArg) abort(`Missing value for flag "${flagName}"`);
          value = nextArg;
        }

        // Ensure value matches flag expectations
        if (
          flag.only &&
          !(flag.only instanceof RegExp
            ? flag.only.test(value)
            : flag.only.includes(value))
        )
          abort(
            `Invalid value for flag "${flagName}". ${errorHelpText} a list of valid values.`
          );

        resultFlags[flagName as keyof ReturnFlags] =
          value as ReturnFlags[string];
        requiredFlags.delete(flagName);
      }
    } else if (arg.startsWith("-")) {
      const shortFlags = arg.substring(1).split("");
      for (const short of shortFlags) {
        // Ignore force flags during parsing as handled by package
        if (short === "f" && command.dangerous) continue;

        const flag = shortFlagMap[short];
        if (!flag)
          abort(
            `Unknown short-flag "${short}" specified. ${errorHelpText} a list of valid flags.`
          );
        else
          resultFlags[flag as keyof ReturnFlags] = true as ReturnFlags[string];
      }
    } else resultArgs.push(arg);
  }

  // Verify no required flags are missing
  /** Any values still in there are missing */
  const missing = Array.from(requiredFlags);
  if (missing.length) abort("Missing required flags: " + missing.join(","));

  // Check that the amount of arguments left is valid
  const validLengths = command.arguments
    ? Array.isArray(command.arguments[0])
      ? command.arguments.map((list) => list.length)
      : [command.arguments.length]
    : [0];

  if (!validLengths.some((length) => length === resultArgs.length))
    abort(
      `Invalid argument count (${resultArgs.length}). ${errorHelpText} valid argument combinations.`
    );

  return [resultArgs, resultFlags as ReturnFlags] as const;
};

/** Creates a new command with inferred types for the flags and arguments. */
export const command = <Flags extends ValidFlags>(
  config: Selective<Executable<Flags>, "dangerous", "run">
) => ({
  runner: (run: Runner<Flags>): Executable<Flags> => ({
    dangerous: false,
    ...config,
    run,
  }),
});

/** Creates a new group of commands */
export const group = (config: Parent) => config;

const runCommand = (
  commandMap: CommandMap,
  [commandName, ...args]: string[],
  path: string[],
  isHelp: boolean
): unknown => {
  const command = commandMap[commandName];
  if (!command) abort(invalidCommandString(commandName, path));

  // If it's a parent command, check fo sub commands
  if ("children" in command) {
    if (isHelp && !args[0]) return logHelp(command, [...path, commandName]);
    return runCommand(command.children, args, [...path, commandName], isHelp);
  }

  if (isHelp) return logHelp(command, [...path, commandName]);

  if (command.dangerous) {
    const isForce =
      args.includes("--force") ||
      !!args.find((arg) => arg.startsWith("-") && arg.includes("f"));
    if (!(isForce || confirm("Are you sure you want to proceed?")))
      abort("Aborted");
  }

  // We are now executing a configured command so check each of it's requirements are met
  return command.run(...parseArgs(args, command));
};

/**
 * Creates a new CLI interface. Run without any commands to use the arguments passed to deno.
 *
 * @example
 * ```ts
 * import * as CLI from "@md/cli";
 *
 * const commands: CLI.CommandMap = {
 *   example: CLI.command(
 *     {
 *       description: "Example command",
 *       arguments: ["two", "commands"], // This command requires two arguments
 *       flags: {
 *         boolean: {
 *           description: "A boolean flag with short form",
 *           type: "boolean", // True if present in arguments
 *           short: "b", // Can use -b instead of --boolean
 *         },
 *         valueEnum: {
 *           description: "A value flag for an enum",
 *           type: "value", // This flag should be a string value
 *           required: true, // False if omitted
 *           only: ["hello", "world"], // Could also be a regex or omitted for `any`
 *         },
 *       },
 *     } as const // Use `as const` to correctly infer flag validation
 *   ).runner((args, flags) => {
 *     // We now get the two validated arguments and typed flags
 *     console.log(args, flags);
 *   }),
 * };
 * CLI.create("Example API", commands).run(); // Same as `CLI.create(...).run(Deno.args);`
 * ```
 *
 * @param commands The commands that are possible in the CLI interface
 * @returns A CLI object which can be run on a set of commands
 */
export const create = (description: string, commands: CommandMap): CLI => ({
  run: (args = Deno.args) => {
    const isHelp = args.includes("--help") || args.includes("-h");
    if (isHelp) {
      // If we're in help mode, ignore flags so we correctly match the group/command the user is requesting help for
      args = args.filter((arg) => !arg.startsWith("-"));

      if (!args[0])
        return logHelp(
          group({
            description,
            children: commands,
          }),
          []
        );
    }
    return runCommand(commands, args, [], isHelp);
  },
});
