-- V5: 친구 검색/목록 확인용 사용자 및 friendship 시드

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
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::UUID,
    'geonwoo@ssafy.com',
    '건우',
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
    WHERE email = 'geonwoo@ssafy.com'
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
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::UUID,
    'geonnam@ssafy.com',
    '건남친구',
    'https://cdn.example.com/p1.jpg',
    'Asia/Seoul',
    'ACTIVE',
    'USER',
    NOW(),
    NOW(),
    NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM users
    WHERE email = 'geonnam@ssafy.com'
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
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::UUID,
    'minsu@ssafy.com',
    '민수',
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
    WHERE email = 'minsu@ssafy.com'
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
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'::UUID,
    'jiyoung@ssafy.com',
    '지영',
    'https://cdn.example.com/profiles/u21.jpg',
    'Asia/Seoul',
    'ACTIVE',
    'USER',
    NOW(),
    NOW(),
    NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM users
    WHERE email = 'jiyoung@ssafy.com'
      AND deleted_at IS NULL
);

INSERT INTO friendships (
    friendship_id,
    user_id,
    friend_user_id,
    status,
    created_at,
    updated_at
)
SELECT
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::UUID,
    '11111111-1111-1111-1111-111111111111'::UUID,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::UUID,
    'REQUESTED',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM friendships
    WHERE friendship_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::UUID
);

INSERT INTO friendships (
    friendship_id,
    user_id,
    friend_user_id,
    status,
    created_at,
    updated_at
)
SELECT
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::UUID,
    '11111111-1111-1111-1111-111111111111'::UUID,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::UUID,
    'ACCEPTED',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM friendships
    WHERE friendship_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::UUID
);

INSERT INTO friendships (
    friendship_id,
    user_id,
    friend_user_id,
    status,
    created_at,
    updated_at
)
SELECT
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::UUID,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'::UUID,
    '11111111-1111-1111-1111-111111111111'::UUID,
    'ACCEPTED',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM friendships
    WHERE friendship_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::UUID
);

INSERT INTO friendships (
    friendship_id,
    user_id,
    friend_user_id,
    status,
    created_at,
    updated_at
)
SELECT
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'::UUID,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::UUID,
    '11111111-1111-1111-1111-111111111111'::UUID,
    'REQUESTED',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM friendships
    WHERE friendship_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'::UUID
);
