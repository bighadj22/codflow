-- Removes all security-test personas and their scopes.
DELETE FROM user_scopes WHERE user_id LIKE 'sectest-%';
DELETE FROM users WHERE id LIKE 'sectest-%';
