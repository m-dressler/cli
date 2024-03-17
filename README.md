# @md/cli

Create a standardized CLI in a type-safe way.

```
import * as CLI from "@md/cli";

const cli = CLI.create({
  example: {
    description: "Showcases @md/cli",
    run: () => console.log("Hello World"),
  },
});
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