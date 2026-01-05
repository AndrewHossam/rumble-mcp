import type { ZodTypeAny, ZodObject, ZodDefault, ZodOptional, ZodEnum, ZodNumber } from 'zod';

/**
 * Simple Zod to JSON Schema converter for MCP tools
 */
export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const def = schema._def;

  if (def.typeName === 'ZodObject') {
    const shape = (schema as ZodObject<any>).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const propSchema = value as ZodTypeAny;
      const propDef = propSchema._def;

      let innerSchema = propSchema;
      let isOptional = false;
      let hasDefault = false;

      // Unwrap defaults and optionals
      if (propDef.typeName === 'ZodDefault') {
        innerSchema = (propSchema as ZodDefault<any>).removeDefault();
        hasDefault = true;
      }
      if (innerSchema._def.typeName === 'ZodOptional') {
        innerSchema = (innerSchema as ZodOptional<any>).unwrap();
        isOptional = true;
      }

      properties[key] = zodToJsonSchema(innerSchema);

      // Add description if available
      if (propDef.description) {
        (properties[key] as Record<string, unknown>).description = propDef.description;
      }

      // Add default value
      if (hasDefault && propDef.defaultValue) {
        (properties[key] as Record<string, unknown>).default = propDef.defaultValue();
      }

      if (!isOptional && !hasDefault) {
        required.push(key);
      }
    }

    const result: Record<string, unknown> = {
      type: 'object',
      properties,
    };

    if (required.length > 0) {
      result.required = required;
    }

    return result;
  }

  if (def.typeName === 'ZodString') {
    return { type: 'string' };
  }

  if (def.typeName === 'ZodNumber') {
    const result: Record<string, unknown> = { type: 'number' };
    const checks = (schema as ZodNumber)._def.checks || [];
    for (const check of checks) {
      if (check.kind === 'min') result.minimum = check.value;
      if (check.kind === 'max') result.maximum = check.value;
    }
    return result;
  }

  if (def.typeName === 'ZodBoolean') {
    return { type: 'boolean' };
  }

  if (def.typeName === 'ZodEnum') {
    return {
      type: 'string',
      enum: (schema as ZodEnum<any>)._def.values,
    };
  }

  if (def.typeName === 'ZodArray') {
    return {
      type: 'array',
      items: zodToJsonSchema(def.type),
    };
  }

  if (def.typeName === 'ZodDefault') {
    const inner = zodToJsonSchema((schema as ZodDefault<any>).removeDefault());
    return {
      ...inner,
      default: def.defaultValue(),
    };
  }

  if (def.typeName === 'ZodOptional') {
    return zodToJsonSchema((schema as ZodOptional<any>).unwrap());
  }

  return {};
}
