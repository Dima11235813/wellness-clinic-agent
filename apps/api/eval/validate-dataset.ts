import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { DATASET_VALIDATION_RULES } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validate the evaluation dataset against predefined rules
 */
function validateDataset() {
    console.log("🔍 Starting dataset validation...");
    console.log("🔍 Validating evaluation dataset...");
    console.log(`📁 Current directory: ${__dirname}`);

    try {
        // For compiled JS, look in the source eval directory
        const isCompiled = __dirname.includes('dist');
        const datasetDir = isCompiled ? path.join(__dirname, '../..', 'eval') : __dirname;
        const datasetPath = path.join(datasetDir, "clinic-policy-evals.json");
        console.log(`📄 Looking for dataset at: ${datasetPath}`);
        const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

        console.log(`📊 Found ${dataset.length} examples to validate`);

        let errors: string[] = [];
        let warnings: string[] = [];

        dataset.forEach((item: any, index: number) => {
            const itemErrors = validateDatasetItem(item, index);
            const itemWarnings = validateDatasetItemWarnings(item, index);

            errors.push(...itemErrors);
            warnings.push(...itemWarnings);
        });

        // Report results
        console.log(`📈 Summary: ${dataset.length} examples validated, ${errors.length} errors, ${warnings.length} warnings`);

        if (errors.length > 0) {
            console.error("❌ Validation failed with the following errors:");
            errors.forEach(error => console.error(`   ${error}`));
            process.exit(1);
        }

        if (warnings.length > 0) {
            console.warn("⚠️  Validation completed with warnings:");
            warnings.forEach(warning => console.warn(`   ${warning}`));
        }

        console.log("✅ Dataset validation passed!");

    } catch (error: any) {
        console.error("❌ Error validating dataset:", error.message);
        process.exit(1);
    }
}

/**
 * Validate a single dataset item
 */
function validateDatasetItem(item: any, index: number): string[] {
    const errors: string[] = [];

    // Check required fields
    DATASET_VALIDATION_RULES.required.forEach(field => {
        if (!(field in item)) {
            errors.push(`Example ${index}: Missing required field '${field}'`);
        }
    });

    // Validate input structure
    if (item.input) {
        if (!item.input.messages || !Array.isArray(item.input.messages)) {
            errors.push(`Example ${index}: input.messages must be an array`);
        } else {
            item.input.messages.forEach((msg: any, msgIndex: number) => {
                // For messages with tool_calls, content is optional
                const hasToolCalls = msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;

                DATASET_VALIDATION_RULES.messageRequired.forEach(field => {
                    if (!(field in msg)) {
                        // Allow missing content if there are tool calls
                        if (field === 'content' && hasToolCalls) {
                            return; // Skip this check
                        }
                        errors.push(`Example ${index}, message ${msgIndex}: Missing required field '${field}'`);
                    }
                });

                if (msg.role && !DATASET_VALIDATION_RULES.validRoles.includes(msg.role)) {
                    errors.push(`Example ${index}, message ${msgIndex}: Invalid role '${msg.role}'. Must be one of: ${DATASET_VALIDATION_RULES.validRoles.join(', ')}`);
                }
            });
        }
    }

    // Validate output structure
    if (item.output) {
        if (!item.output.messages || !Array.isArray(item.output.messages)) {
            errors.push(`Example ${index}: output.messages must be an array`);
        } else {
            item.output.messages.forEach((msg: any, msgIndex: number) => {
                // For messages with tool_calls, content is optional
                const hasToolCalls = msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;

                DATASET_VALIDATION_RULES.messageRequired.forEach(field => {
                    if (!(field in msg)) {
                        // Allow missing content if there are tool calls
                        if (field === 'content' && hasToolCalls) {
                            return; // Skip this check
                        }
                        errors.push(`Example ${index}, output message ${msgIndex}: Missing required field '${field}'`);
                    }
                });

                if (msg.role && !DATASET_VALIDATION_RULES.validRoles.includes(msg.role)) {
                    errors.push(`Example ${index}, output message ${msgIndex}: Invalid role '${msg.role}'. Must be one of: ${DATASET_VALIDATION_RULES.validRoles.join(', ')}`);
                }
            });
        }
    }

    return errors;
}

/**
 * Validate dataset items for warnings (non-blocking issues)
 */
function validateDatasetItemWarnings(item: any, index: number): string[] {
    const warnings: string[] = [];

    // Check for contextPolicyRequired flag
    if (!('contextPolicyRequired' in item)) {
        warnings.push(`Example ${index}: Missing 'contextPolicyRequired' metadata (recommended for evaluation)`);
    }

    // Check message content length
    if (item.input?.messages) {
        item.input.messages.forEach((msg: any, msgIndex: number) => {
            if (msg.content && msg.content.length > 1000) {
                warnings.push(`Example ${index}, message ${msgIndex}: Very long message content (${msg.content.length} chars)`);
            }
        });
    }

    if (item.output?.messages) {
        item.output.messages.forEach((msg: any, msgIndex: number) => {
            if (msg.content && msg.content.length > 1000) {
                warnings.push(`Example ${index}, output message ${msgIndex}: Very long message content (${msg.content.length} chars)`);
            }
        });
    }

    return warnings;
}

// Run validation if this script is executed directly
const normalizedImportUrl = import.meta.url.replace(/^file:\/\/\//, '').replace(/\\/g, '/');
const normalizedArgv1 = process.argv[1].replace(/\\/g, '/');
if (normalizedImportUrl === normalizedArgv1) {
    validateDataset();
}

export { validateDataset };
