CREATE TRIGGER IF NOT EXISTS jobs_preserve_known_company
AFTER UPDATE OF company ON jobs
WHEN lower(trim(COALESCE(NEW.company, ''))) IN (
  '',
  'unknown',
  'company is hidden',
  'hidden company',
  'невідома компанія',
  'компанію приховано',
  'компания скрыта',
  'n/a',
  'none',
  '-'
)
AND lower(trim(COALESCE(OLD.company, ''))) NOT IN (
  '',
  'unknown',
  'company is hidden',
  'hidden company',
  'невідома компанія',
  'компанію приховано',
  'компания скрыта',
  'n/a',
  'none',
  '-'
)
BEGIN
  UPDATE jobs
  SET company = OLD.company
  WHERE id = NEW.id;
END;
