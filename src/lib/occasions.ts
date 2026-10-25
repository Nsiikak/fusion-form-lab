/** Occasion guides: what to do when, and which vendors each event type needs.
 *  Single source for the home page, /plan pages, event creation and event checklists. */
export type VendorCat = "venue" | "catering" | "decoration" | "photography" | "entertainment" | "logistics" | "cakes" | "drinks" | "beauty" | "fashion" | "planning" | "rentals" | "sound_lighting" | "souvenirs" | "ushers_security";

export interface Occasion {
  slug: string;
  name: string;
  tagline: string;
  timeline: string;               // how far ahead to start
  vendors: { category: VendorCat; label: string; why: string }[];
  stages: { when: string; tasks: { id: string; text: string; category?: VendorCat }[] }[];
  tip: string;
}

export const OCCASIONS: Occasion[] = [
  {
    slug: "wedding", name: "Wedding", tagline: "White wedding and reception: the full plan, from budget to the last dance.",
    timeline: "Start 6\u201312 months before",
    vendors: [
      { category: "venue", label: "Venue", why: "Book first: dates fill up fast in peak months" },
      { category: "catering", label: "Caterer", why: "The largest share of most wedding budgets" },
      { category: "cakes", label: "Cake", why: "Order 1\u20132 months ahead" },
      { category: "drinks", label: "Drinks and bar", why: "Cocktails, mocktails and bar service" },
      { category: "beauty", label: "Make-up and gele", why: "Book trials early" },
      { category: "fashion", label: "Tailoring and aso-ebi", why: "Outfits for the couple and the families" },
      { category: "planning", label: "Planner or coordinator", why: "Optional: someone to run the day" },
      { category: "decoration", label: "D\u00e9cor and styling", why: "Hall d\u00e9cor, flowers, centrepieces" },
      { category: "photography", label: "Photo and video", why: "Pre-wedding shoot and the day itself" },
      { category: "entertainment", label: "DJ, MC or live band", why: "Keeps the reception moving" },
      { category: "rentals", label: "Rentals", why: "Chairs, tables, canopies" },
      { category: "sound_lighting", label: "Sound and lighting", why: "PA, stage lights, screens" },
      { category: "logistics", label: "Transport", why: "Cars for the couple and family" },
      { category: "souvenirs", label: "Souvenirs and IV cards", why: "Order early for printing" },
      { category: "ushers_security", label: "Ushers and security", why: "Guest flow and safety" },
    ],
    stages: [
      { when: "6\u201312 months before", tasks: [
        { id: "budget", text: "Agree the budget and who is paying for what" },
        { id: "guests", text: "Draft the guest list with both families" },
        { id: "date", text: "Fix the dates for the traditional and white weddings" },
        { id: "venue", text: "Book the church or mosque and the reception venue", category: "venue" },
        { id: "asoebi", text: "Choose colours and aso-ebi fabric" },
      ] },
      { when: "3\u20136 months before", tasks: [
        { id: "caterer", text: "Book the caterer and agree the menu", category: "catering" },
        { id: "decor", text: "Book the decorator and agree the look", category: "decoration" },
        { id: "photo", text: "Book the photographer and videographer", category: "photography" },
        { id: "music", text: "Book the DJ or band and the MC", category: "entertainment" },
        { id: "cake", text: "Order the cake", category: "cakes" },
        { id: "beauty", text: "Book make-up, gele and hair (with a trial)", category: "beauty" },
      ] },
      { when: "1\u20132 months before", tasks: [
        { id: "invites", text: "Send invitations and IV cards" },
        { id: "rentals", text: "Arrange chairs, canopies, lighting and power", category: "rentals" },
        { id: "souvenirs", text: "Order souvenirs and IV cards", category: "souvenirs" },
        { id: "transport", text: "Plan transport for the couple and family", category: "logistics" },
        { id: "fittings", text: "Final outfit fittings" },
      ] },
      { when: "The last 2 weeks", tasks: [
        { id: "headcount", text: "Give the caterer the final headcount" },
        { id: "reconfirm", text: "Check every vendor has reconfirmed on Plagohive" },
        { id: "seating", text: "Plan seating, souvenirs and the order of events" },
      ] },
      { when: "On the day", tasks: [
        { id: "pointperson", text: "Name one person to manage vendors on the day" },
        { id: "confirm", text: "After the event, confirm each service on Plagohive so vendors are paid" },
      ] },
    ],
    tip: "Book the venue and caterer first: the best ones go months ahead in peak season.",
  },
  {
    slug: "traditional-engagement", name: "Traditional engagement", tagline: "Introduction, engagement or wine carrying: honour the families, plan the feast.",
    timeline: "Start 2\u20134 months before",
    vendors: [
      { category: "catering", label: "Caterer", why: "Native dishes, small chops and drinks for both families" },
      { category: "decoration", label: "D\u00e9cor", why: "Traditional setting and colours" },
      { category: "entertainment", label: "MC and drummers or band", why: "An experienced traditional MC guides the rites" },
      { category: "photography", label: "Photo and video", why: "The rites happen once" },
      { category: "logistics", label: "Canopies, chairs and sound", why: "Most are held at the family home" },
    ],
    stages: [
      { when: "2\u20134 months before", tasks: [
        { id: "list", text: "Get the engagement list from the bride's family" },
        { id: "budget", text: "Agree the budget between both families" },
        { id: "venue", text: "Confirm the location (usually the bride's family home)", category: "venue" },
        { id: "asoebi", text: "Choose colours and aso-ebi" },
      ] },
      { when: "1\u20132 months before", tasks: [
        { id: "caterer", text: "Book the caterer for native dishes and small chops", category: "catering" },
        { id: "mc", text: "Book a traditional MC and drummers or a band", category: "entertainment" },
        { id: "decor", text: "Book d\u00e9cor for the traditional setting", category: "decoration" },
        { id: "photo", text: "Book photo and video", category: "photography" },
        { id: "rentals", text: "Arrange canopies, chairs and sound", category: "logistics" },
      ] },
      { when: "The last 2 weeks", tasks: [
        { id: "items", text: "Buy and pack the items on the engagement list" },
        { id: "reconfirm", text: "Check every vendor has reconfirmed on Plagohive" },
      ] },
      { when: "On the day", tasks: [
        { id: "confirm", text: "After the event, confirm each service on Plagohive" },
      ] },
    ],
    tip: "Ask the bride's family for the list early: some items take weeks to find.",
  },
  {
    slug: "birthday", name: "Milestone birthday", tagline: "30th, 40th, 50th and beyond: a party people will talk about.",
    timeline: "Start 1\u20133 months before",
    vendors: [
      { category: "venue", label: "Venue", why: "Lounge, hall or garden" },
      { category: "catering", label: "Caterer and small chops", why: "The food is what guests remember" },
      { category: "cakes", label: "Cake", why: "The centrepiece of the night" },
      { category: "drinks", label: "Drinks and bar", why: "Cocktails and mocktails" },
      { category: "entertainment", label: "DJ or live band", why: "Sets the energy" },
      { category: "decoration", label: "D\u00e9cor", why: "Theme, balloons, backdrop" },
      { category: "photography", label: "Photographer", why: "For the memories and the posts" },
    ],
    stages: [
      { when: "1\u20133 months before", tasks: [
        { id: "budget", text: "Set the budget and guest list" },
        { id: "theme", text: "Choose a theme and dress code" },
        { id: "venue", text: "Book the venue", category: "venue" },
        { id: "caterer", text: "Book the caterer, small chops and cake", category: "catering" },
        { id: "music", text: "Book the DJ or band", category: "entertainment" },
      ] },
      { when: "2\u20134 weeks before", tasks: [
        { id: "decor", text: "Book d\u00e9cor and the photo backdrop", category: "decoration" },
        { id: "photo", text: "Book a photographer", category: "photography" },
        { id: "invites", text: "Send invitations" },
        { id: "souvenirs", text: "Order souvenirs" },
      ] },
      { when: "The last week", tasks: [
        { id: "reconfirm", text: "Check every vendor has reconfirmed on Plagohive" },
        { id: "headcount", text: "Give the caterer the final headcount" },
      ] },
      { when: "On the day", tasks: [
        { id: "confirm", text: "After the party, confirm each service on Plagohive" },
      ] },
    ],
    tip: "Book the DJ and caterer first; d\u00e9cor can usually be arranged closer to the date.",
  },
  {
    slug: "naming-ceremony", name: "Naming ceremony", tagline: "Welcome the new baby with family and friends, without the stress.",
    timeline: "Usually within 1\u20132 weeks",
    vendors: [
      { category: "catering", label: "Caterer and cake", why: "Rice, small chops and drinks for guests" },
      { category: "logistics", label: "Canopies, chairs and sound", why: "Often held at home" },
      { category: "photography", label: "Photographer", why: "The baby's first big day" },
      { category: "decoration", label: "Simple d\u00e9cor", why: "A welcoming setting" },
    ],
    stages: [
      { when: "As soon as the date is set", tasks: [
        { id: "date", text: "Confirm the date and officiant with the family" },
        { id: "guests", text: "Agree the guest list" },
        { id: "caterer", text: "Book the caterer and cake", category: "catering" },
        { id: "rentals", text: "Book canopies, chairs and sound", category: "logistics" },
      ] },
      { when: "The days before", tasks: [
        { id: "photo", text: "Book a photographer", category: "photography" },
        { id: "decor", text: "Arrange simple d\u00e9cor", category: "decoration" },
        { id: "souvenirs", text: "Order souvenirs" },
        { id: "items", text: "Prepare the traditional items for the ceremony" },
      ] },
      { when: "On the day", tasks: [
        { id: "confirm", text: "After the ceremony, confirm each service on Plagohive" },
      ] },
    ],
    tip: "Timelines are short, so book vendors who can confirm quickly: Plagohive refunds you if they don't accept within 48 hours.",
  },
  {
    slug: "corporate", name: "Corporate event", tagline: "End-of-year parties, launches, retreats: accountable vendors and proper receipts.",
    timeline: "Start 1\u20133 months before",
    vendors: [
      { category: "venue", label: "Venue", why: "Capacity, location and power" },
      { category: "catering", label: "Caterer", why: "Menu for the headcount and dietary needs" },
      { category: "entertainment", label: "MC, DJ and sound", why: "Programme flow and announcements" },
      { category: "decoration", label: "D\u00e9cor and branding", why: "Backdrops, banners, stage" },
      { category: "sound_lighting", label: "Sound, lighting and screens", why: "Presentations and stage" },
      { category: "ushers_security", label: "Ushers and security", why: "Registration and guest flow" },
      { category: "photography", label: "Photo and video", why: "Content for internal and external comms" },
      { category: "logistics", label: "Transport and rentals", why: "Staff shuttles, chairs, generators" },
    ],
    stages: [
      { when: "1\u20133 months before", tasks: [
        { id: "approve", text: "Get the budget approved and the headcount agreed" },
        { id: "venue", text: "Book the venue", category: "venue" },
        { id: "caterer", text: "Book the caterer", category: "catering" },
        { id: "programme", text: "Draft the programme and speakers" },
      ] },
      { when: "2\u20134 weeks before", tasks: [
        { id: "av", text: "Book the MC, DJ and sound", category: "entertainment" },
        { id: "branding", text: "Book d\u00e9cor and branding", category: "decoration" },
        { id: "photo", text: "Book photo and video", category: "photography" },
        { id: "transport", text: "Arrange transport and rentals", category: "logistics" },
      ] },
      { when: "The last week", tasks: [
        { id: "reconfirm", text: "Check every vendor has reconfirmed on Plagohive" },
        { id: "receipts", text: "Download Plagohive receipts for finance" },
      ] },
      { when: "On the day", tasks: [
        { id: "confirm", text: "After the event, confirm each service on Plagohive" },
      ] },
    ],
    tip: "Every Plagohive payment comes with a numbered receipt, ready for your finance team.",
  },
  {
    slug: "celebration-of-life", name: "Burial and celebration of life", tagline: "Support for families honouring a loved one, handled with care.",
    timeline: "Usually 2\u20136 weeks",
    vendors: [
      { category: "catering", label: "Caterer", why: "Reception for mourners and guests" },
      { category: "logistics", label: "Canopies, chairs and sound", why: "For the service and reception" },
      { category: "entertainment", label: "Band or music", why: "For the service of songs and reception" },
      { category: "photography", label: "Photo and video", why: "For the family's record" },
      { category: "decoration", label: "D\u00e9cor and flowers", why: "A respectful setting" },
    ],
    stages: [
      { when: "First, with the family", tasks: [
        { id: "family", text: "Agree the dates, budget and roles as a family" },
        { id: "programme", text: "Prepare the programme and the brochure or obituary" },
        { id: "venue", text: "Confirm the locations for the service and reception", category: "venue" },
      ] },
      { when: "2\u20134 weeks before", tasks: [
        { id: "caterer", text: "Book the caterer for the reception", category: "catering" },
        { id: "rentals", text: "Book canopies, chairs and sound", category: "logistics" },
        { id: "music", text: "Book a band or music", category: "entertainment" },
        { id: "photo", text: "Book photo and video", category: "photography" },
        { id: "decor", text: "Arrange d\u00e9cor and flowers", category: "decoration" },
      ] },
      { when: "The last week", tasks: [
        { id: "reconfirm", text: "Check every vendor has reconfirmed on Plagohive" },
      ] },
      { when: "After the event", tasks: [
        { id: "confirm", text: "Confirm each service on Plagohive so vendors are paid" },
      ] },
    ],
    tip: "Let one family member handle vendor bookings so nothing is booked twice.",
  },
];

export const occasionBySlug = (slug?: string | null) => OCCASIONS.find((o) => o.slug === slug);
export const allTaskIds = (o: Occasion) => o.stages.flatMap((s) => s.tasks.map((t) => `${s.when}|${t.id}`));
export const taskKey = (stage: string, id: string) => `${stage}|${id}`;
