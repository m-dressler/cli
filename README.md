# @md/cli

Create a standardized CLI in a type-safe way.

```
import * as CLI from "@md/cli";

const commands: CLI.CommandMap = {
  example: CLI.command(
    {
      description: "Example command",
      arguments: ["two", "commands"], // This command requires two arguments
      flags: {
        boolean: {
          description: "A boolean flag with short form",
          type: "boolean", // True if present in arguments
          short: "b", // Can use -b instead of --boolean
        },
        valueEnum: {
          description: "A value flag for an enum",
          type: "value", // This flag should be a string value
          required: true, // False if omitted
          only: ["hello", "world"], // Could also be a regex or omitted for `any`
        },
      },
    } as const // Use `as const` to correctly infer flag validation
  ).runner((args, flags) => {
    // We now get the two validated arguments and typed flags
    console.log(args, flags); 
  }),
};
CLI.create("Example API", commands).run(); // Same as `CLI.create(...).run(Deno.args);`
```

## Philosophy

Here is how the CLI created with @md/cli is structured:

command subcommand arg1 arg2 --boolflag -f --flag1 val1 --flags=val2
\________________/ \_______/ \______________________________________/
     Commands      Arguments                Flags

### Commands

You first have 1 - many commands. Each command specifies how many arguments it takes and valid flags to be used with it.

### Arguments

The arguments are fully variable values that are passed to the command

### Flags

Flags have two types with two forms each:

#### Boolean flags

Boolean flags only signal true or false such as `--example` and can have a short form e.g., `-e`

#### Value flags

Value flags carry with them some information and can come in the form `--example value` or `--example=value`. Each value flag only has one value associated to it.