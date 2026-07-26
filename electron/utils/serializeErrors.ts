/**
 * A `JSON.stringify` replacer that preserves `Error` messages/stacks.
 * Plain `JSON.stringify(new Error("x"))` produces `"{}"` because `message` and `stack`
 * aren't own enumerable properties, which otherwise turns every thrown error into an
 * empty object once it crosses the birpc IPC boundary.
 */
export function serializeErrors(key: string, value: unknown): unknown {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack
        };
    }

    return value;
}
