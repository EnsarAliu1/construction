/** Reviewed installer output. No migrations run inside an application request. */
export const tidbExpectedSchema = {
 version: 'construction-tidb-schema/2',
 fingerprint: '5d10484934ce52763603a59f4cec6a5b8d283acc1eed583c0c0236cff2cb0caf',
} as const;
export function matchesTidbSchema(rows: readonly {id: unknown; plan_sha256: unknown}[]) {
 return rows.length === 1 && rows[0].id === tidbExpectedSchema.version && rows[0].plan_sha256 === tidbExpectedSchema.fingerprint;
}
