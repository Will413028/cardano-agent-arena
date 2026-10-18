import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
// Blaze's own generator emits type-only names as value imports (Node type stripping rejects them) and pulls
// @blaze-cardano/tx into every importer; the verifier shares this module and must not load transaction building (I9).
interface Schema { $ref?: string; dataType?: string; anyOf?: Schema[]; index?: number; fields?: Schema[]; items?: Schema; title?: string }
const blueprint = JSON.parse(readFileSync(join(ROOT, 'validators/plutus.json'), 'utf8'));
const definitions: Record<string, Schema> = blueprint.definitions;
function name(key: string) { return key.replace(/[^a-zA-Z0-9]/g, '_'); }
function schema(node: Schema, seen: string[] = []): string {
  if (node.$ref) {
    const key = decodeURIComponent(node.$ref.replace('#/definitions/', '')).replaceAll('~1', '/').replaceAll('~0', '~');
    if (seen.includes(key)) throw new Error(`Recursive blueprint type: ${key}`);
    return schema(definitions[key], [...seen, key]);
  }
  if (node.anyOf) {
    if (node.anyOf.length === 1) return schema(node.anyOf[0], seen);
    return `Type.Union([${node.anyOf.map(variant => schema(variant, seen)).join(', ')}])`;
  }
  if (node.dataType === 'constructor') {
    const fields = (node.fields ?? []).map((field, i) => `${field.title ?? `field${i}`}: ${schema(field, seen)}`);
    return `Type.Object({ ${fields.join(', ')} }, { ctor: ${node.index}n })`;
  }
  if (node.dataType === 'integer') return 'Type.BigInt()';
  if (node.dataType === 'bytes') return 'Type.String()';
  if (node.dataType === 'list' && node.items) return `Type.Array(${schema(node.items, seen)})`;
  if (!node.dataType) return 'TPlutusData';
  throw new Error(`Unsupported blueprint type: ${node.dataType}`);
}
const source = '// Generated from validators/plutus.json; do not edit.\n' +
  "import { Type, TPlutusData, type Exact } from '@blaze-cardano/data';\n" +
  Object.keys(definitions).map(key => `export const ${name(key)} = ${schema({ $ref: `#/definitions/${key.replaceAll('/', '~1')}` })};\n` +
    `export type ${name(key)} = Exact<typeof ${name(key)}>;`).join('\n') + '\n' +
  'export const MatchDatum = skeleton_MatchDatum;\nexport type MatchDatum = skeleton_MatchDatum;\n' +
  'export const MatchRedeemer = Int;\nexport type MatchRedeemer = Int;\n';
const destination = join(ROOT, 'offchain/generated/contract.ts');
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== source) throw new Error('Blueprint generated types drifted; run npm run generate');
  console.log('Blueprint types match.');
} else writeFileSync(destination, source);
