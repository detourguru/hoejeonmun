create index casting_edits_user_id_created_at_idx on casting_edits (user_id, created_at desc)
  where source = 'correction';
