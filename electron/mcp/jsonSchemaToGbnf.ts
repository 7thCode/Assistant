import type {GbnfJsonSchema} from "node-llama-cpp";

type JsonSchemaObject = {
    type?: string | string[],
    properties?: Record<string, JsonSchemaObject>,
    items?: JsonSchemaObject,
    enum?: Array<string | number | boolean | null>,
    description?: string
};

/**
 * Best-effort conversion of a JSON Schema (as used by an MCP tool's `inputSchema`) into the more
 * constrained `GbnfJsonSchema` shape node-llama-cpp needs to grammar-constrain function calling.
 * Advanced JSON Schema features ($ref, anyOf/allOf, tuple validation, etc.) aren't supported and are dropped;
 * unrecognized property schemas fall back to an unconstrained string.
 */
export function jsonSchemaToGbnf(schema: JsonSchemaObject | undefined): GbnfJsonSchema {
    if (schema == null)
        return {type: "object", properties: {}};

    if (schema.enum != null)
        return {enum: schema.enum, description: schema.description};

    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

    switch (type) {
        case "object": {
            const properties: Record<string, GbnfJsonSchema> = {};
            for (const [key, value] of Object.entries(schema.properties ?? {}))
                properties[key] = jsonSchemaToGbnf(value);

            return {type: "object", properties, description: schema.description};
        }

        case "array":
            return {type: "array", items: jsonSchemaToGbnf(schema.items), description: schema.description};

        case "string":
            return {type: "string", description: schema.description};

        case "number":
        case "integer":
            return {type, description: schema.description};

        case "boolean":
            return {type: "boolean", description: schema.description};

        default:
            return {type: "string", description: schema.description};
    }
}
