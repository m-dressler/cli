import type { Flag, Command, Selective } from "./types.d.ts";
export type { Command, Flag };

// deno-lint-ignore no-explicit-any
export type CLI = { run: (args?: string[]) => Promise<any> };

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

const logHelp = (command: Command<Flag.ValidFlags>, path: string[]) => {
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
      ) as Command.ArgumentList[];
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

const parseArgs = <T extends Command.Executable<Flag.ValidFlags>>(
  args: string[],
  command: T
): [args: string[], flags: Flag.FlagsReturn<Flag.ValidFlags>] => {
  const expectedFlags = command.flags || {};

  const shortFlagMap: Record<string, string> = {};
  const requiredFlags = new Set<string>();

  type ReturnFlags = Flag.FlagsReturn<typeof expectedFlags>;
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
          `Unknown flag "${flagName}" specified. Run command with "--help" for a list of valid flags.`
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
            `Unknown short-flag "${short}" specified. Run command with "--help" for a list of valid flags.`
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
      `Invalid argument count (${resultArgs.length}). Run command with "--help" for valid argument combinations.`
    );

  return [resultArgs, resultFlags as ReturnFlags] as const;
};

export const command = <Flags extends Flag.ValidFlags>(
  config: Selective<Command.Executable<Flags>, "dangerous", "run">
) => ({
  runner: (run: Command.Runner<Flags>): Command.Executable<Flags> => ({
    dangerous: false,
    ...config,
    run,
  }),
});

export const group = (config: Command.Parent) => config;

const runCommand = (
  commandMap: Command.Map,
  [commandName, ...args]: string[],
  path: string[],
  isHelp: boolean
): // deno-lint-ignore no-explicit-any
any => {
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
 * const commands: CLI.Command.Map = {
 *   example: CLI.command({
 *   })
 * }
 *
 * CLI.create("Example API", commands).run(); // Same as `CLI.create(...).run(Deno.args);`
 * ```
 *
 * @param commands The commands that are possible in the CLI interface
 * @returns A
 */
export const create = (description: string, commands: Command.Map): CLI => ({
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
