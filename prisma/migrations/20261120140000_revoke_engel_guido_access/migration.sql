-- Revoke access without deleting leads, email records or member history.
UPDATE `Tenant` SET `status` = 'SUSPENDED', `distributionPaused` = TRUE
WHERE LOWER(`slug`) REGEXP '(^|[^a-z])(engels?|guido)([^a-z]|$)'
   OR LOWER(`name`) REGEXP '(^|[^a-z])(engels?|guido)([^a-z]|$)';
UPDATE `User` SET `active` = FALSE, `distPaused` = TRUE
WHERE `isPlatformAdmin` = FALSE AND (
  LOWER(`username`) IN ('martin', 'selina', 'frances', 'francis')
  OR LOWER(`displayName`) REGEXP '^(martin|selina|frances|francis)([^a-z]|$)'
  OR `tenantId` IN (SELECT `id` FROM `Tenant`
    WHERE LOWER(`slug`) REGEXP '(^|[^a-z])(engels?|guido)([^a-z]|$)'
       OR LOWER(`name`) REGEXP '(^|[^a-z])(engels?|guido)([^a-z]|$)')
);
