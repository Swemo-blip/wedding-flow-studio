import type { DinnerTable, Guest } from "@/lib/wedding-types";

// The classic wedding purchases, with the quantity DERIVED from the couple's own
// plan rather than a generic "buy some candles". Every count traces to a real
// number in their project — guests, seated guests, tables — and the source is
// shown next to it so nothing here is an unexplained figure.
//
// Deliberately not a shop: no prices, no links, no vendors. It is the list you
// take with you, which is the part nobody else gets right.
export type SupplyLine = {
  id: string;
  item: string;
  quantity: number;
  basis: string;
  group: "Paper" | "Table" | "Ceremony" | "Keepsakes";
  note: string;
};

export function buildSupplyList(guests: Guest[], tables: DinnerTable[]): SupplyLine[] {
  const guestCount = guests.length;
  const seated = guests.filter((guest) => guest.tableId).length;
  const tableCount = tables.length;

  const lines: SupplyLine[] = [
    { basis: "one per guest", group: "Paper", id: "place-cards", item: "Place cards", note: "Print them from the Print page.", quantity: guestCount },
    { basis: "one per guest", group: "Paper", id: "menu-cards", item: "Menu cards", note: "One per cover, or one per two if you prefer.", quantity: guestCount },
    { basis: "one per guest", group: "Paper", id: "programmes", item: "Order of service", note: "", quantity: guestCount },
    { basis: "one per table", group: "Paper", id: "table-numbers", item: "Table numbers", note: "", quantity: tableCount },
    { basis: "one for the entrance", group: "Paper", id: "table-plan", item: "Table plan board", note: "A3 or larger so it reads from a distance.", quantity: tableCount > 0 ? 1 : 0 },
    { basis: "three per table", group: "Table", id: "tapers", item: "Taper candles", note: "Buy spares — they burn down over a long dinner.", quantity: tableCount * 3 },
    { basis: "three per table", group: "Table", id: "candle-holders", item: "Candle holders", note: "", quantity: tableCount * 3 },
    { basis: "one per table", group: "Table", id: "centrepieces", item: "Centrepiece vessels", note: "", quantity: tableCount },
    { basis: "one per seated guest", group: "Table", id: "napkins", item: "Napkins", note: "", quantity: seated },
    { basis: "one per seated guest", group: "Table", id: "favours", item: "Favours", note: "", quantity: seated },
    { basis: "for the aisle", group: "Ceremony", id: "aisle-candles", item: "Aisle candles or lanterns", note: "Count the pew ends you want lit.", quantity: 0 },
    { basis: "one", group: "Ceremony", id: "ring-box", item: "Ring box", note: "", quantity: 1 },
    { basis: "one per guest", group: "Ceremony", id: "confetti", item: "Confetti cones", note: "Check the venue allows it, and what kind.", quantity: guestCount },
    { basis: "one", group: "Keepsakes", id: "guest-book", item: "Guest book and pens", note: "", quantity: 1 },
    { basis: "one", group: "Keepsakes", id: "cake-knife", item: "Cake knife and server", note: "", quantity: 1 },
    { basis: "one per guest", group: "Keepsakes", id: "thank-you-cards", item: "Thank-you cards", note: "For afterwards — the addresses are in your guest list.", quantity: guestCount }
  ];

  // A line whose count is zero has nothing honest to say yet, except the aisle
  // candles, which are a real decision the couple has to make themselves.
  return lines.filter((line) => line.quantity > 0 || line.id === "aisle-candles");
}

export const supplyGroups: SupplyLine["group"][] = ["Paper", "Table", "Ceremony", "Keepsakes"];
