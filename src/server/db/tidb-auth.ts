/** Cloud-only append-only authentication generations; account identity remains operator-managed. */
export function tidbAuthDdl(){return [
 `CREATE TABLE auth_user_versions (
  user_id CHAR(36) NOT NULL,auth_version INT UNSIGNED NOT NULL,recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY(user_id,auth_version),CONSTRAINT auth_user_versions_positive_ck CHECK(auth_version>=1) ENFORCED,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT)`,
 `CREATE SQL SECURITY INVOKER VIEW auth_users AS
  SELECT u.id,u.display_name,u.email,u.password_hash,u.status,u.deactivated_at,u.created_at,
  GREATEST(u.updated_at,COALESCE(v.recorded_at,u.updated_at)) AS updated_at,
  GREATEST(u.auth_version,COALESCE(v.auth_version,u.auth_version)) AS auth_version
  FROM users u LEFT JOIN auth_user_versions v ON v.user_id=u.id
  WHERE v.user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth_user_versions newer WHERE newer.user_id=v.user_id AND newer.auth_version>v.auth_version)`
];}
