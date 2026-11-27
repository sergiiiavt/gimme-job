-- Backfill Robota.ua's Russian catch-all region label persisted from api.rabota.ua.
-- New source records are canonicalized before storage by the Robota.ua adapter.
UPDATE jobs
SET location = 'Інші країни'
WHERE location = 'Другие страны';
