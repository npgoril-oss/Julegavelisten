export type Id = string;

/** En mottaker. Personer er felles for alle år – de "følger med" automatisk til nytt år. */
export interface Person {
  id: Id;
  name: string;
  /** Arkiverte personer vises ikke, men historikken beholdes. */
  archived: boolean;
}

/** Ett element i en gave (en gave kan bestå av flere items). */
export interface Item {
  id: Id;
  name: string;
  price: number;
  note: string;
  link: string;
  /** Kjøpt eller bestilt. */
  purchased: boolean;
  /** Mottatt (levert / i hus). */
  received: boolean;
}

/** En gave til en person for et gitt år. */
export interface Gift {
  id: Id;
  personId: Id;
  year: number;
  title: string;
  /** Budsjett i kroner. null = ikke satt. */
  budget: number | null;
  wrapped: boolean;
  items: Item[];
}

export interface AppData {
  version: 1;
  persons: Person[];
  gifts: Gift[];
}
