// Generated from validators/plutus.json; do not edit.
export type ByteArray = { bytes: string };
export type Data = unknown;
export type Int = { int: number };
export type List_ByteArray_ = { list: Array<ByteArray> };
export type List_Int_ = { list: Array<Int> };
export type cardano_transaction_OutputReference = { constructor: 0; fields: [ByteArray, Int] };
export type skeleton_MatchDatum = { constructor: 0; fields: [List_ByteArray_, List_Int_, ByteArray, Int] };
export type MatchDatum = skeleton_MatchDatum;
export type MatchRedeemer = Int;
