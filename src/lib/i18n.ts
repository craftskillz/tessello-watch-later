// The English and French catalogs of the Watch Later Module. The language follows the `locale` of the handshake;
// English is the default.

const en = {
  loading: "Loading…",
  load_retry: "Try again",

  add_label: "Paste a YouTube URL",
  row_all: "All",
  empty: "No videos yet. Paste a YouTube URL above or anywhere on this page, or drop a link here.",
  videos: "Videos",
  drop_here: "Drop to add",

  already_there: "This video is already in your list",
  not_youtube: "This is not a YouTube video",
  added_summary: "{added} added, {existing} already there, {ignored} ignored",

  fetching: "Reading the title…",
  meta_retry: "Retry",
  meta_retry_label: "Read the title of {title} again",
  thumbnail: "Thumbnail of {title}",

  watched: "Watched",
  to_watch: "To watch",
  watched_on: "Watched on {date}",
  mark_watched: "Mark as watched",
  mark_to_watch: "Mark as to watch",
  marked_watched: "Marked as watched",
  undo: "Undo",
  hide_watched: "Hide watched",
  all_watched: "Every video is watched. Uncheck Hide watched to see them again.",
  details: "Details",
  has_note: "Has a note",
  channel: "Channel",
  added: "Added",
  status: "Status",
  note: "Note",
  note_placeholder: "Why you kept this video",
  open_on_youtube: "Open on YouTube ↗",
  close: "Close",
  cancel: "Cancel",
  delete: "Delete",
  delete_title: "Delete this video?",
  delete_message: "“{title}” will be removed from your list.",

  added_now: "just now",
  added_minutes: "{count} min ago",
  added_hours: "{count} h ago",
  added_yesterday: "yesterday",
  added_days: "{count} days ago",

  load_error: "Your videos could not be read ({reason}). Nothing can be added until they are read, so that nothing is lost.",
  save_error: "Your last change could not be saved ({reason}). It is still on screen, but will be lost when you leave.",
  save_error_quota: "Your last change could not be saved: the storage of the Watch Later Module is full. It is still on screen, but will be lost when you leave.",
};

type Messages = typeof en;

const fr: Messages = {
  loading: "Chargement…",
  load_retry: "Réessayer",

  add_label: "Coller une URL YouTube",
  row_all: "Toutes",
  empty: "Aucune vidéo pour l'instant. Collez une URL YouTube ci-dessus ou n'importe où sur cette page, ou déposez un lien ici.",
  videos: "Vidéos",
  drop_here: "Déposer pour ajouter",

  already_there: "Cette vidéo est déjà dans votre liste",
  not_youtube: "Ce n'est pas une vidéo YouTube",
  added_summary: "Ajoutées : {added} · Déjà là : {existing} · Ignorées : {ignored}",

  fetching: "Lecture du titre…",
  meta_retry: "Réessayer",
  meta_retry_label: "Relire le titre de {title}",
  thumbnail: "Miniature de {title}",

  watched: "Vue",
  to_watch: "À voir",
  watched_on: "Vue le {date}",
  mark_watched: "Marquer comme vue",
  mark_to_watch: "Marquer comme à voir",
  marked_watched: "Marquée comme vue",
  undo: "Annuler",
  hide_watched: "Cacher les vues",
  all_watched: "Toutes les vidéos sont vues. Décochez « Cacher les vues » pour les revoir.",
  details: "Détails",
  has_note: "A une note",
  channel: "Chaîne",
  added: "Ajoutée",
  status: "Statut",
  note: "Note",
  note_placeholder: "Pourquoi vous gardez cette vidéo",
  open_on_youtube: "Ouvrir sur YouTube ↗",
  close: "Fermer",
  cancel: "Annuler",
  delete: "Supprimer",
  delete_title: "Supprimer cette vidéo ?",
  delete_message: "« {title} » sera retirée de votre liste.",

  added_now: "à l'instant",
  added_minutes: "il y a {count} min",
  added_hours: "il y a {count} h",
  added_yesterday: "hier",
  added_days: "il y a {count} jours",

  load_error: "Vos vidéos n'ont pas pu être lues ({reason}). Rien ne peut être ajouté tant qu'elles ne sont pas lues, pour ne rien perdre.",
  save_error: "Votre dernière modification n'a pas pu être enregistrée ({reason}). Elle reste à l'écran, mais sera perdue en quittant.",
  save_error_quota:
    "Votre dernière modification n'a pas pu être enregistrée : le stockage du Module Watch Later est plein. Elle reste à l'écran, mais sera perdue en quittant.",
};

export type MessageKey = keyof Messages;

let messages: Messages = en;

/** Chooses the catalog for a BCP 47 tag, such as "fr-FR"; English for any other language. */
export function setLocale(locale: string): void {
  messages = locale.toLowerCase().split("-")[0] === "fr" ? fr : en;
}

/** The message in the current language, with each `{name}` replaced by its value. */
export function t(key: MessageKey, values: Record<string, string | number> = {}): string {
  return messages[key].replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
