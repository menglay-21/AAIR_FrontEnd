-- AAIR - Permission matrix for ADMIN and MANAGER.
-- Run this file once in pgAdmin while connected to database aair_db.

CREATE TABLE IF NOT EXISTS role_permissions (
    role        VARCHAR(20) NOT NULL,
    feature     VARCHAR(40) NOT NULL,
    action      VARCHAR(20) NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by  BIGINT REFERENCES users(id),
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_role_permissions PRIMARY KEY (role, feature, action),
    CONSTRAINT ck_role_permissions_role CHECK (role IN ('ADMIN', 'MANAGER')),
    CONSTRAINT ck_role_permissions_feature CHECK (
        feature IN (
            'DASHBOARD',
            'USER_MANAGEMENT',
            'PERMISSION_MANAGEMENT',
            'AUDIT_LOGS',
            'DOCUMENTS',
            'SESSIONS',
            'TASKS',
            'STATISTICS'
        )
    ),
    CONSTRAINT ck_role_permissions_action CHECK (
        action IN ('READ', 'WRITE', 'EXECUTE', 'DELETE')
    )
);

WITH role_list(role) AS (
    VALUES ('ADMIN'), ('MANAGER')
),
feature_list(feature) AS (
    VALUES
        ('DASHBOARD'),
        ('USER_MANAGEMENT'),
        ('PERMISSION_MANAGEMENT'),
        ('AUDIT_LOGS'),
        ('DOCUMENTS'),
        ('SESSIONS'),
        ('TASKS'),
        ('STATISTICS')
),
action_list(action) AS (
    VALUES ('READ'), ('WRITE'), ('EXECUTE'), ('DELETE')
)
INSERT INTO role_permissions (role, feature, action, enabled)
SELECT r.role,
       f.feature,
       a.action,
       CASE
           WHEN r.role = 'ADMIN' AND (
               (f.feature = 'DASHBOARD' AND a.action = 'READ') OR
               (f.feature = 'USER_MANAGEMENT' AND a.action IN ('READ', 'WRITE')) OR
               (f.feature = 'PERMISSION_MANAGEMENT' AND a.action IN ('READ', 'WRITE')) OR
               (f.feature = 'AUDIT_LOGS' AND a.action = 'READ')
           ) THEN TRUE
           WHEN r.role = 'MANAGER' AND (
               (f.feature = 'DASHBOARD' AND a.action = 'READ') OR
               (f.feature = 'USER_MANAGEMENT' AND a.action IN ('READ', 'WRITE')) OR
               (f.feature = 'PERMISSION_MANAGEMENT' AND a.action = 'READ') OR
               (f.feature = 'DOCUMENTS' AND a.action IN ('READ', 'WRITE', 'DELETE')) OR
               (f.feature = 'SESSIONS' AND a.action IN ('READ', 'WRITE', 'EXECUTE')) OR
               (f.feature = 'TASKS' AND a.action IN ('READ', 'WRITE', 'EXECUTE')) OR
               (f.feature = 'STATISTICS' AND a.action = 'READ')
           ) THEN TRUE
           ELSE FALSE
       END
FROM role_list r
CROSS JOIN feature_list f
CROSS JOIN action_list a
ON CONFLICT (role, feature, action) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_role_permissions_role
    ON role_permissions (role);

SELECT role, feature, action, enabled
FROM role_permissions
ORDER BY role, feature, action;
