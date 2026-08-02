import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Apps launched from Finder/Dock (not a terminal) inherit macOS's minimal default PATH, which is missing
 * anything installed via Homebrew, nvm, etc. That breaks spawning tools like `npx` for MCP servers, even
 * though the exact same command works fine from a terminal. This mirrors the user's login shell's PATH
 * into `process.env.PATH` so spawned child processes see the same PATH a terminal would.
 */
export async function fixShellPathEnv(): Promise<void> {
    if (process.platform === "win32")
        return;

    const shell = process.env.SHELL ?? "/bin/zsh";
    const startMarker = "__ASSISTANT_PATH_START__";
    const endMarker = "__ASSISTANT_PATH_END__";

    try {
        const {stdout} = await execFileAsync(shell, ["-ilc", `echo -n "${startMarker}\${PATH}${endMarker}"`], {
            timeout: 5000
        });

        const match = new RegExp(`${startMarker}(.*)${endMarker}`, "s").exec(stdout);
        const shellPath = match?.[1];
        if (shellPath == null || shellPath === "")
            return;

        const shellEntries = shellPath.split(path.delimiter).filter((entry) => entry !== "");
        const currentEntries = (process.env.PATH ?? "").split(path.delimiter).filter((entry) => entry !== "");

        process.env.PATH = [...new Set([...shellEntries, ...currentEntries])].join(path.delimiter);
    } catch (err) {
        console.error("Failed to import the login shell's PATH; tools installed outside the default PATH " +
            "(e.g. Homebrew's npx) may fail to spawn for MCP servers", err);
    }
}
