-- Linkziele entfernen, die Mailprogramme an Telefonnummern/E-Mail-Adressen gehängt haben,
-- z. B. "+491759550607 <+49%20175%209550607>" -> "+491759550607"
UPDATE `Lead` SET `phone` = TRIM(REGEXP_REPLACE(`phone`, '[[:space:]]*<[^<>[:space:]]+>', '')) WHERE `phone` LIKE '%<%>%';
UPDATE `Lead` SET `email` = TRIM(REGEXP_REPLACE(`email`, '[[:space:]]*<[^<>[:space:]]+>', '')) WHERE `email` LIKE '%<%>%';
UPDATE `Lead` SET `fullName` = TRIM(REGEXP_REPLACE(`fullName`, '[[:space:]]*<[^<>[:space:]]+>', '')) WHERE `fullName` LIKE '%<%>%';
