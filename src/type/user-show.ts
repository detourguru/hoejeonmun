import { GenreCode } from "@/type/show";

export const USER_SHOW_POSTER_BUCKET = "show-posters";

export const MAX_USER_SHOW_POSTER_BYTES = 10 * 1024 * 1024;
export const MAX_TICKET_LINKS = 5;

export type TicketLink = { name: string; url: string };

export type UserShowInput = {
  title: string;
  posterPath: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  genre: GenreCode;
  venue: string;
  ticketLinks: TicketLink[];
};
