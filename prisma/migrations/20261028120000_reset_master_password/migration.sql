-- Setzt das Passwort des Master-Accounts neu.
UPDATE `User` SET `passwordHash` = '$2b$12$v5mIdTA8zSQYiJshZTOeAOQJrkKJkdWnT1vz8XdO/KSYlJ4.NXKKy' WHERE `id` = 'user_master_account';
