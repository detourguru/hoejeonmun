grant select, insert, update, delete on
  actors,
  assignments,
  bug_reports,
  casting_parse_consensus_logs,
  event_groups,
  event_reports,
  event_slots,
  events,
  favorites,
  my_event_groups,
  my_slots,
  parse_failures,
  poster_thumbnail_failures,
  poster_thumbnail_stale_files,
  poster_thumbnails,
  show_title_aliases,
  slots,
  upload_images,
  uploads,
  user_shows,
  vandal_reports,
  venue_halls
to service_role;

grant select on
  actors,
  assignments,
  event_slots,
  poster_thumbnails,
  slots,
  user_shows,
  venue_halls
to anon, authenticated;

grant select on uploads to authenticated;
grant insert on user_shows to authenticated;
grant select, insert on bug_reports to authenticated;
grant select, insert, delete on
  event_reports,
  favorites,
  my_event_groups,
  my_slots,
  vandal_reports
to authenticated;

grant select on
  current_castings,
  current_events,
  exist_events,
  hidden_castings,
  hidden_events,
  slot_castings
to anon, authenticated, service_role;
