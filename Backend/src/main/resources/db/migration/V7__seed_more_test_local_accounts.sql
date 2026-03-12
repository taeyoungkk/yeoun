-- V7: additional local test accounts for invite and permission scenarios

INSERT INTO users (
    user_id,
    email,
    nickname,
    profile_image_url,
    timezone,
    status,
    role,
    created_at,
    updated_at,
    deleted_at
)
SELECT
    '33333333-3333-3333-3333-333333333331'::UUID,
    'test1@ssafy.com',
    '테스트1',
    NULL,
    'Asia/Seoul',
    'ACTIVE',
    'USER',
    NOW(),
    NOW(),
    NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM users
    WHERE email = 'test1@ssafy.com'
      AND deleted_at IS NULL
);

INSERT INTO users (
    user_id,
    email,
    nickname,
    profile_image_url,
    timezone,
    status,
    role,
    created_at,
    updated_at,
    deleted_at
)
SELECT
    '33333333-3333-3333-3333-333333333332'::UUID,
    'test2@ssafy.com',
    '테스트2',
    NULL,
    'Asia/Seoul',
    'ACTIVE',
    'USER',
    NOW(),
    NOW(),
    NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM users
    WHERE email = 'test2@ssafy.com'
      AND deleted_at IS NULL
);

INSERT INTO users (
    user_id,
    email,
    nickname,
    profile_image_url,
    timezone,
    status,
    role,
    created_at,
    updated_at,
    deleted_at
)
SELECT
    '33333333-3333-3333-3333-333333333333'::UUID,
    'test3@ssafy.com',
    '테스트3',
    NULL,
    'Asia/Seoul',
    'ACTIVE',
    'USER',
    NOW(),
    NOW(),
    NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM users
    WHERE email = 'test3@ssafy.com'
      AND deleted_at IS NULL
);

INSERT INTO user_auth_accounts (
    auth_account_id,
    user_id,
    provider,
    provider_user_id,
    login_email,
    password_hash,
    password_changed_at,
    created_at,
    updated_at
)
SELECT
    '44444444-4444-4444-4444-444444444441'::UUID,
    u.user_id,
    'LOCAL',
    NULL,
    'test1@ssafy.com',
    '$2a$10$sCxa1FKtsGurrdjvyR2ofualeeH0HeoNGqFPIk3/AcQPD5o0oNdI.',
    NOW(),
    NOW(),
    NOW()
FROM users u
WHERE u.email = 'test1@ssafy.com'
  AND NOT EXISTS (
      SELECT 1
      FROM user_auth_accounts a
      WHERE a.provider = 'LOCAL'
        AND a.login_email = 'test1@ssafy.com'
  );

INSERT INTO user_auth_accounts (
    auth_account_id,
    user_id,
    provider,
    provider_user_id,
    login_email,
    password_hash,
    password_changed_at,
    created_at,
    updated_at
)
SELECT
    '44444444-4444-4444-4444-444444444442'::UUID,
    u.user_id,
    'LOCAL',
    NULL,
    'test2@ssafy.com',
    '$2a$10$sCxa1FKtsGurrdjvyR2ofualeeH0HeoNGqFPIk3/AcQPD5o0oNdI.',
    NOW(),
    NOW(),
    NOW()
FROM users u
WHERE u.email = 'test2@ssafy.com'
  AND NOT EXISTS (
      SELECT 1
      FROM user_auth_accounts a
      WHERE a.provider = 'LOCAL'
        AND a.login_email = 'test2@ssafy.com'
  );

INSERT INTO user_auth_accounts (
    auth_account_id,
    user_id,
    provider,
    provider_user_id,
    login_email,
    password_hash,
    password_changed_at,
    created_at,
    updated_at
)
SELECT
    '44444444-4444-4444-4444-444444444443'::UUID,
    u.user_id,
    'LOCAL',
    NULL,
    'test3@ssafy.com',
    '$2a$10$sCxa1FKtsGurrdjvyR2ofualeeH0HeoNGqFPIk3/AcQPD5o0oNdI.',
    NOW(),
    NOW(),
    NOW()
FROM users u
WHERE u.email = 'test3@ssafy.com'
  AND NOT EXISTS (
      SELECT 1
      FROM user_auth_accounts a
      WHERE a.provider = 'LOCAL'
        AND a.login_email = 'test3@ssafy.com'
  );
