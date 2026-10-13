-- Cover foreign-key lookups used by session/user cleanup and verification.
create index email_mfa_challenges_session_id_idx
  on private.email_mfa_challenges (session_id);

create index email_mfa_verified_sessions_user_id_idx
  on private.email_mfa_verified_sessions (user_id);
