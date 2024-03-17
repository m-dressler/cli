export type Selective<
  // deno-lint-ignore no-explicit-any
  T extends { [k: string]: any },
  Optionals extends keyof T,
  Omits extends keyof T
> = Omit<T, Omits | Optionals> & Partial<Pick<T, Optionals>>;

export namespace Flag {
  type Base = {
    description: string;
  };
  export type BooleanFlag = Base & {
    type: "boolean";
    short?: string;
  };
  export type ValueFlag = Base & {
    type: "value";
    required?: boolean;
    /** The values this flag accepts. If omitted, accepts anything */
    only?: RegExp | string[];
  };
  export type Flag = BooleanFlag | ValueFlag;

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

  type RequiredReturn<
    Required extends boolean | void,
    T
  > = Required extends true ? T : T | undefined;
  type FlagReturn<T extends Flag> = T extends ValueFlag
    ? RequiredReturn<
        T["required"],
        // TODO TS doesn't correctly return enum options as values here
        T["only"] extends Array<infer R> ? R : string
      >
    : boolean;
  export type FlagsReturn<T extends ValidFlags> = {
    [key in Exclude<keyof T, InvalidFlags>]: FlagReturn<T[key]>;
  };
}

export type Flag = Flag.Flag;

export namespace Command {
  export type Runner<Flags extends Flag.ValidFlags> = (
    args: string[],
    flags: Flags extends Flag.ValidFlags
      ? {
          [key in Exclude<keyof Flags, Flag.InvalidFlags>]: Flag.FlagReturn<
            Flags[key]
          >;
        }
      : void
    // deno-lint-ignore no-explicit-any
  ) => any;

  export type ArgumentList = string[];

  type Base = {
    description: string;
  };
  export type Executable<Flags extends Flag.ValidFlags> = Base & {
    run: Command.Runner<Flags>;
    dangerous: boolean;
    arguments?: ArgumentList | ArgumentList[];
    flags?: Flags;
    /** An example on how to use the command */
    example?: string;
  };
  export type Parent = Base & {
    children: Map;
  };
  export type Command<Flags extends Flag.ValidFlags> =
    | Parent
    | Executable<Flags>;

  // deno-lint-ignore no-explicit-any
  export type Map = { [key: string]: Command<any> };
}

export type Command<Flags extends Flag.ValidFlags> = Command.Command<Flags>;
