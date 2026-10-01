import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './devnet.ts';
interface Schema { $ref?: string; dataType?: string; anyOf?: Schema[]; index?: number; fields?: Schema[]; items?: Schema }
const blueprint = JSON.parse(readFileSync(join(ROOT, 'validators/plutus.json'), 'utf8'));
const definitions: Record<string, Schema> = blueprint.definitions;
function name(key: string) { return key.replace(/[^a-zA-Z0-9]/g, '_'); }
function type(schema: Schema): string {
  if (schema.$ref) return name(decodeURIComponent(schema.$ref.replace('#/definitions/', '')).replaceAll('~1', '/').replaceAll('~0', '~'));
  if (schema.anyOf) return schema.anyOf.map(type).join(' | ');
  if (schema.dataType === 'constructor') return `{ constructor: ${schema.index}; fields: [${(schema.fields ?? []).map(type).join(', ')}] }`;
  if (schema.dataType === 'integer') return '{ int: number }';
  if (schema.dataType === 'bytes') return '{ bytes: string }';
  if (schema.dataType === 'list' && schema.items) return `{ list: Array<${type(schema.items)}> }`;
  if (!schema.dataType) return 'unknown';
  throw new Error(`Unsupported blueprint type: ${schema.dataType}`);
}
const source = '// Generated from validators/plutus.json; do not edit.\n' +
  Object.entries(definitions).map(([key, schema]) => `export type ${name(key)} = ${type(schema)};`).join('\n') + '\n' +
  'export type MatchDatum = skeleton_MatchDatum;\nexport type MatchRedeemer = Int;\n';
const destination = join(ROOT, 'offchain/generated/contract.ts');
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== source) throw new Error('Blueprint generated types drifted; run npm run generate');
  console.log('Blueprint types match.');
} else writeFileSync(destination, source);
