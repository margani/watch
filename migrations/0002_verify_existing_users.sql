-- Sign-in now waits for a confirmed email where the site sends mail (#35). Accounts made before
-- that have been in use all along, so they count as confirmed instead of being locked out.
UPDATE `user` SET `email_verified` = 1 WHERE `email_verified` = 0;
