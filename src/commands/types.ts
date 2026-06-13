// A command handler receives its remaining argv and returns a process exit code.
export type Command = (argv: string[]) => Promise<number> | number;
