-- V2: 테스트용 LOCAL 로그인 계정 시드

INSERT INTO users (
    user_id,
    email,
    nickname,
    profile_image_url,
    timezone,
    status,
    created_at,
    updated_at,
    deleted_at
)
SELECT
    '11111111-1111-1111-1111-111111111111'::UUID,
    'test@ssafy.com',
    '테스트',
    NULL,
    'Asia/Seoul',
    'ACTIVE',
    NOW(),
    NOW(),
    NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM users
    WHERE email = 'test@ssafy.com'
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
    '22222222-2222-2222-2222-222222222222'::UUID,
    u.user_id,
    'LOCAL',
    NULL,
    'test@ssafy.com',
    '$2a$10$sCxa1FKtsGurrdjvyR2ofualeeH0HeoNGqFPIk3/AcQPD5o0oNdI.',
    NOW(),
    NOW(),
    NOW()
FROM users u
WHERE u.email = 'test@ssafy.com'
  AND NOT EXISTS (
      SELECT 1
      FROM user_auth_accounts a
      WHERE a.provider = 'LOCAL'
        AND a.login_email = 'test@ssafy.com'
  );
