CREATE UNIQUE INDEX "player_flags_user_flag_uniq" ON "player_flags" USING btree ("user_id","flag_key");
