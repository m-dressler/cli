import { assertThrows, assertFalse, assertEquals } from "@std/assert";
import { LogHistory, assertConsole } from "@md/assert-console";

import * as CLI from "./index.ts";
import {} from "jsr:@std/assert@^0.220.1/assert_false";

class ExitError extends Error {
  constructor(public status: number | undefined) {
    super(`${status}`);
  }
}

Deno.exit = (status) => {
  throw new ExitError(status);
};

const commands: CLI.Command.Map = {
  basic: CLI.command({
    description: "This is a basic command",
  }).runner(() => console.log("basic")),

  danger: CLI.command({
    description: "Dangerous command",
    dangerous: true,
    flags: {
      other: {
        description: "Other flag",
        type: "boolean",
        short: "o",
      },
    },
  }).runner(() => console.log("danger")),

  argsOnly: CLI.command({
    description: "Example with only args",
    arguments: [["arg1"], ["arg1", "arg2", "arg3"]],
  }).runner((args) => console.log("argsOnly", ...args)),

  argsAndFlags: CLI.command({
    description: "Example with flags and args",
    arguments: ["arg1", "arg2", "arg3"],
    flags: {
      boolean: {
        description: "A boolean flag without short form",
        type: "boolean",
      },
      booleanShort: {
        description: "A boolean flag WITH short form",
        type: "boolean",
        short: "b",
      },
      booleanShort2: {
        description: "A second boolean flag WITH short form for stacking",
        type: "boolean",
        short: "t",
      },
      value: {
        description: "A value flag for any type of string",
        type: "value",
      },
      requiredValue: {
        description: "A required value flag for any type of string",
        type: "value",
        required: true,
      },
      valueEnum: {
        description: "A value flag for an enum",
        type: "value",
        values: ["hello", "world"],
      },
      valueRegex: {
        description: "A value flag for regex",
        type: "value",
        values: /\d+/,
      },
    },
  }).runner((args, flags) => console.log(args, flags)),

  nest1: CLI.group({
    description: "First level nesting",
    children: {
      noInput: CLI.command({
        description: "Example with no arguments or flags",
      }).runner(() => console.log("noInput", "nest1")),

      nest2: CLI.group({
        description: "Second level nesting",
        children: {
          noInput: CLI.command({
            description: "Example with no arguments or flags",
          }).runner(() => console.log("noInput", "nest2")),
        },
      }),
    },
  }),
};

const cli = CLI.create("An example API", commands);

const testCommand =
  ({
    input,
    errorExit,
    ...logs
  }: {
    input: string[];
    errorExit: boolean;
  } & Partial<LogHistory>) =>
  () => {
    if (errorExit) assertThrows(() => cli.run(input), ExitError, "1");
    else {
      try {
        cli.run(input);
      } catch (error) {
        if (error instanceof ExitError) {
          assertConsole(logs);
          assertFalse(
            true,
            `CLI exited with status ${error.status} when it should have run safely`
          );
        } else throw error;
      }
    }
    assertConsole(logs);
  };

Deno.test({
  name: "Cli lists commands",
  fn: testCommand({
    input: ["--help"],
    errorExit: false,
    log: [
      [
        [
          'Help for group "":',
          "",
          "Description:",
          "An example API",
          "",
          "Subcommands:",
          "",
          "\tbasic        | command: This is a basic command",
          "\tdanger       | command: Dangerous command",
          "\targsOnly     | command: Example with only args",
          "\targsAndFlags | command: Example with flags and args",
          "\tnest1        | group  : First level nesting",
        ].join("\n"),
      ],
    ],
  }),
});

Deno.test({
  name: "Unknown command throws error",
  fn: testCommand({
    input: ["fugazi"],
    errorExit: true,
    error: [
      [
        'The command "fugazi" doesn\'t exist. Run "--help" to get a list of valid commands.',
      ],
    ],
  }),
});

Deno.test({
  name: "Basic command without inputs works",
  fn: testCommand({
    input: ["basic"],
    errorExit: false,
    log: [["basic"]],
  }),
});

Deno.test({
  name: "Basic command with arguments throws error",
  fn: testCommand({
    input: ["basic", "arg1"],
    errorExit: true,
    error: [
      [
        'Invalid argument count (1). Run command with "--help" for valid argument combinations.',
      ],
    ],
  }),
});

Deno.test({
  name: "Unknown flag command throws error",
  fn: testCommand({
    input: ["basic", "--unknown-flag"],
    errorExit: true,
    error: [
      [
        'Unknown flag "unknown-flag" specified. Run command with "--help" for a list of valid flags.',
      ],
    ],
  }),
});

Deno.test({
  name: "Basic command help flag works",
  fn: testCommand({
    input: ["basic", "--help"],
    errorExit: false,
    log: [
      [
        [
          'Help for command "basic":',
          "",
          "Description:",
          "This is a basic command",
          "",
          "Arguments: NONE",
          "",
          "Flags: NONE",
        ].join("\n"),
      ],
    ],
  }),
});

Deno.test({
  name: "Basic command short help flag works",
  fn: testCommand({
    input: ["basic", "-h"],
    errorExit: false,
    log: [
      [
        [
          'Help for command "basic":',
          "",
          "Description:",
          "This is a basic command",
          "",
          "Arguments: NONE",
          "",
          "Flags: NONE",
        ].join("\n"),
      ],
    ],
  }),
});

Deno.test({
  name: "Dangerous command stops if not confirmed",
  fn: () => {
    let confirmMessage;
    globalThis.confirm = (prompt) => {
      confirmMessage = prompt;
      return false;
    };
    testCommand({
      input: ["danger"],
      errorExit: true,
      error: [["Aborted"]],
    })();
    assertEquals(confirmMessage, "Are you sure you want to proceed?");
  },
});

Deno.test({
  name: "Dangerous command continues if confirmed",
  fn: () => {
    let confirmMessage;
    globalThis.confirm = (prompt) => {
      confirmMessage = prompt;
      return true;
    };
    testCommand({
      input: ["danger"],
      errorExit: false,
      log: [["danger"]],
    })();
    assertEquals(confirmMessage, "Are you sure you want to proceed?");
  },
});

Deno.test({
  name: "Dangerous command stops if not confirmed",
  fn: () => {
    let confirmMessage;
    globalThis.confirm = (prompt) => {
      confirmMessage = prompt;
      return false;
    };
    testCommand({
      input: ["danger"],
      errorExit: true,
      error: [["Aborted"]],
    })();
    assertEquals(confirmMessage, "Are you sure you want to proceed?");
  },
});

Deno.test({
  name: "Dangerous command supports --force flag",
  fn: () => {
    globalThis.confirm = () => {
      assertFalse(true, "Confirm called with force flag");
      return false;
    };
    testCommand({
      input: ["danger", "--force"],
      errorExit: false,
      log: [["danger"]],
    })();
  },
});

Deno.test({
  name: "Dangerous command supports short -f force flag",
  fn: () => {
    globalThis.confirm = () => {
      assertFalse(true, "Confirm called with force flag");
      return false;
    };
    testCommand({
      input: ["danger", "-f"],
      errorExit: false,
      log: [["danger"]],
    })();
  },
});

Deno.test({
  name: "Dangerous command supports short -f force flag in stack",
  fn: () => {
    globalThis.confirm = () => {
      assertFalse(true, "Confirm called with force flag");
      return false;
    };
    testCommand({
      input: ["danger", "-fo"],
      errorExit: false,
      log: [["danger"]],
    })();
  },
});

Deno.test({
  name: "Command fails if no arguments provided",
  fn: testCommand({
    input: ["argsOnly"],
    errorExit: true,
    error: [
      [
        'Invalid argument count (0). Run command with "--help" for valid argument combinations.',
      ],
    ],
  }),
});

Deno.test({
  name: "A single arguments gets correctly passed",
  fn: testCommand({
    input: ["argsOnly", "arg2"],
    errorExit: false,
    log: [["argsOnly", "arg2"]],
  }),
});

Deno.test({
  name: "Two arguments fails",
  fn: testCommand({
    input: ["argsOnly", "arg1", "arg2"],
    errorExit: true,
    error: [
      [
        'Invalid argument count (2). Run command with "--help" for valid argument combinations.',
      ],
    ],
  }),
});

Deno.test({
  name: "Three arguments passes",
  fn: testCommand({
    input: ["argsOnly", "arg1", "arg2", "arg3"],
    errorExit: false,
    log: [["argsOnly", "arg1", "arg2", "arg3"]],
  }),
});

Deno.test({
  name: "Four arguments fails",
  fn: testCommand({
    input: ["argsOnly", "arg1", "arg2", "arg3", "arg4"],
    errorExit: true,
    error: [
      [
        'Invalid argument count (4). Run command with "--help" for valid argument combinations.',
      ],
    ],
  }),
});

Deno.test({
  name: "An unexpected flag gets correctly rejected",
  fn: testCommand({
    input: ["argsOnly", "arg1", "arg2", "--unknown-flag"],
    errorExit: true,
    error: [
      [
        'Unknown flag "unknown-flag" specified. Run command with "--help" for a list of valid flags.',
      ],
    ],
  }),
});

Deno.test({
  name: "Rejected when required flag is missing",
  fn: testCommand({
    input: ["argsAndFlags"],
    errorExit: true,
    error: [["Missing required flags: requiredValue"]],
  }),
});

Deno.test({
  name: "Rejected when required flag has no value",
  fn: testCommand({
    input: ["argsAndFlags", "--requiredValue"],
    errorExit: true,
    error: [['Missing value for flag "requiredValue"']],
  }),
});

Deno.test({
  name: "Fails when required flag is provided with value but arguments missing",
  fn: testCommand({
    input: ["argsAndFlags", "--requiredValue", "someValue"],
    errorExit: true,
    error: [
      [
        'Invalid argument count (0). Run command with "--help" for valid argument combinations.',
      ],
    ],
  }),
});

Deno.test({
  name: "Passes when required flag is provided with value and arguments present",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue",
      "someValue",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: false,
          booleanShort: false,
          booleanShort2: false,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "Passes when value is passed in `--flag=value` format",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue=someValue",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: false,
          booleanShort: false,
          booleanShort2: false,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "Correctly updates boolean flag",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue=someValue",
      "--boolean",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: true,
          booleanShort: false,
          booleanShort2: false,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "Correctly updates long-typed short boolean flag",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue=someValue",
      "--booleanShort",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: false,
          booleanShort: true,
          booleanShort2: false,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "Correctly rejects unknown short-flag",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue=someValue",
      "-b",
      "-i",
    ],
    errorExit: true,
    error: [
      [
        'Unknown short-flag "i" specified. Run command with "--help" for a list of valid flags.',
      ],
    ],
  }),
});

Deno.test({
  name: "Correctly rejects unknown stacked short-flag",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue=someValue",
      "-b",
      "-i",
    ],
    errorExit: true,
    error: [
      [
        'Unknown short-flag "i" specified. Run command with "--help" for a list of valid flags.',
      ],
    ],
  }),
});

Deno.test({
  name: "Correctly updates short boolean flag",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue=someValue",
      "-b",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: false,
          booleanShort: true,
          booleanShort2: false,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "Correctly updates other short boolean flag",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue=someValue",
      "-t",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: false,
          booleanShort: false,
          booleanShort2: true,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "Correctly updates two short boolean flag",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue=someValue",
      "-b",
      "-t",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: false,
          booleanShort: true,
          booleanShort2: true,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "Correctly updates two stacked boolean flag",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue=someValue",
      "-bt",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: false,
          booleanShort: true,
          booleanShort2: true,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "Correctly updates two reverse-stacked boolean flag",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue=someValue",
      "-tb",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: false,
          booleanShort: true,
          booleanShort2: true,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "Argument gets passed when at the end",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "--requiredValue=someValue",
      "arg1",
      "arg2",
      "arg3",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: false,
          booleanShort: false,
          booleanShort2: false,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "Argument gets passed when in the middle",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "--boolean",
      "arg1",
      "arg2",
      "arg3",
      "--requiredValue=someValue",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: true,
          booleanShort: false,
          booleanShort2: false,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "Argument gets passed when distributed",
  fn: testCommand({
    input: [
      "argsAndFlags",
      "arg1",
      "--boolean",
      "arg2",
      "--requiredValue=someValue",
      "arg3",
    ],
    errorExit: false,
    log: [
      [
        ["arg1", "arg2", "arg3"],
        {
          boolean: true,
          booleanShort: false,
          booleanShort2: false,
          requiredValue: "someValue",
        },
      ],
    ],
  }),
});

Deno.test({
  name: "`noInput` without nesting doesn't work",
  fn: testCommand({
    input: ["noInput"],
    errorExit: true,
    error: [
      [
        'The command "noInput" doesn\'t exist. Run "--help" to get a list of valid commands.',
      ],
    ],
  }),
});

Deno.test({
  name: "Nesting without command doesn't work",
  fn: testCommand({
    input: ["nest1"],
    errorExit: true,
    error: [
      [
        'No subcommand specified. Run "nest1 --help" to get a list of valid subcommands.',
      ],
    ],
  }),
});

Deno.test({
  name: "`noInput` with nesting works",
  fn: testCommand({
    input: ["nest1", "noInput"],
    errorExit: false,
    log: [["noInput", "nest1"]],
  }),
});

Deno.test({
  name: "Second nesting without command doesn't work",
  fn: testCommand({
    input: ["nest1", "nest2"],
    errorExit: true,
    error: [
      [
        'No subcommand specified. Run "nest1 nest2 --help" to get a list of valid subcommands.',
      ],
    ],
  }),
});

Deno.test({
  name: "`noInput` with second nesting is different",
  fn: testCommand({
    input: ["nest1", "nest2", "noInput"],
    errorExit: false,
    log: [["noInput", "nest2"]],
  }),
});

Deno.test({
  name: "Help info for nesting level 1 correct",
  fn: testCommand({
    input: ["nest1", "--help"],
    errorExit: false,
    log: [
      [
        [
          'Help for group "nest1":',
          "",
          "Description:",
          "First level nesting",
          "",
          "Subcommands:",
          "",
          "\tnoInput | command: Example with no arguments or flags",
          "\tnest2   | group  : Second level nesting",
        ].join("\n"),
      ],
    ],
  }),
});

Deno.test({
  name: "Help info for nesting level 1 subcommand correct",
  fn: testCommand({
    input: ["nest1", "noInput", "--help"],
    errorExit: false,
    log: [
      [
        [
          'Help for command "nest1/noInput":',
          "",
          "Description:",
          "Example with no arguments or flags",
          "",
          "Arguments: NONE",
          "",
          "Flags: NONE",
        ].join("\n"),
      ],
    ],
  }),
});

Deno.test({
  name: "Help info for nesting level 2 correct",
  fn: testCommand({
    input: ["nest1", "nest2", "--help"],
    errorExit: false,
    log: [
      [
        [
          'Help for group "nest1/nest2":',
          "",
          "Description:",
          "Second level nesting",
          "",
          "Subcommands:",
          "",
          "\tnoInput | command: Example with no arguments or flags",
        ].join("\n"),
      ],
    ],
  }),
});

Deno.test({
  name: "Help info for nesting level 2 subcommand correct",
  fn: testCommand({
    input: ["nest1", "nest2", "noInput", "--help"],
    errorExit: false,
    log: [
      [
        [
          'Help for command "nest1/nest2/noInput":',
          "",
          "Description:",
          "Example with no arguments or flags",
          "",
          "Arguments: NONE",
          "",
          "Flags: NONE",
        ].join("\n"),
      ],
    ],
  }),
});

// TODO Force flag error on non dangerous command

// TODO Force short-flag error on non dangerous command

// TODO Force short-flag error on non dangerous command in stack
