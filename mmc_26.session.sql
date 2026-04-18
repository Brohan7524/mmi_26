CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS geo_profiles (
    id UUID PRIMARY KEY,
    user_id TEXT,
    label TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_meters INT,
    zone_type TEXT,
    active_hours JSONB
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    user_id TEXT,
    content TEXT,
    priority TEXT,
    category TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO geo_profiles 
(id, user_id, label, lat, lng, radius_meters, zone_type)
VALUES
(gen_random_uuid(), 'user_1', 'home', 13.0827, 80.2707, 200, 'always_deliver'),
(gen_random_uuid(), 'user_1', 'gym', 13.0800, 80.2600, 150, 'critical_only');

SELECT * FROM geo_profiles;