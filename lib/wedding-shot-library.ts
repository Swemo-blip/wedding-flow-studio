// The group photographs almost every wedding takes, in the order a photographer
// works through them. Presets carry only a title and the moment they belong to —
// WHO is in each one always comes from the couple's own guest list, because that
// is the part a photographer cannot guess and the couple cannot remember on the
// day.
export type ShotPreset = {
  id: string;
  title: string;
  moment: string;
};

export const shotLibrary: ShotPreset[] = [
  { id: "couple-portraits", moment: "Photography", title: "The couple, portraits" },
  { id: "couple-first-look", moment: "Photography", title: "First look" },
  { id: "rings", moment: "Ceremony", title: "The rings, close up" },
  { id: "whole-party", moment: "Photography", title: "Everyone, one big group" },
  { id: "bride-family", moment: "Photography", title: "Bride with her family" },
  { id: "groom-family", moment: "Photography", title: "Groom with his family" },
  { id: "both-families", moment: "Photography", title: "Both families together" },
  { id: "bride-parents", moment: "Photography", title: "Bride with her parents" },
  { id: "groom-parents", moment: "Photography", title: "Groom with his parents" },
  { id: "grandparents", moment: "Photography", title: "With the grandparents" },
  { id: "siblings", moment: "Photography", title: "With the siblings" },
  { id: "bridal-party", moment: "Photography", title: "The bridal party" },
  { id: "bridesmaids", moment: "Photography", title: "Bride with the bridesmaids" },
  { id: "groomsmen", moment: "Photography", title: "Groom with the groomsmen" },
  { id: "children", moment: "Photography", title: "With the children" },
  { id: "officiant", moment: "Ceremony", title: "With the officiant" },
  { id: "speeches", moment: "Speeches", title: "Speeches, from the side" },
  { id: "cake", moment: "Cake", title: "Cutting the cake" },
  { id: "first-dance", moment: "First Dance", title: "The first dance" },
  { id: "room-empty", moment: "Dinner Service", title: "The room before anyone sits down" }
];

export function shotLibraryByMoment() {
  const order = ["Photography", "Ceremony", "Dinner Service", "Speeches", "Cake", "First Dance"];
  return order
    .map((moment) => ({ moment, presets: shotLibrary.filter((preset) => preset.moment === moment) }))
    .filter((group) => group.presets.length > 0);
}
