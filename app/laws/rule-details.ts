import type { WILDS_COMMAND_LAW } from "@/features/play/wilds-world-constitution";

type Law = (typeof WILDS_COMMAND_LAW)[keyof typeof WILDS_COMMAND_LAW];
export type RuleDetail = { title: string; summary: string; requirements: string; success: string; blocked: string; example: string };

// Editorial explanations of the registered command families, not additional authority.
export const RULE_DETAILS = {
  "sources.reserve": {
    title: "Pack gathered resources", summary: "Bind exact available resources into one source-carrying package.",
    requirements: "An authenticated gatherer selects current material lots, grove resources or food with verified admitted gather history. The server verifies exact source, current custody and availability through a real conditional shared-inventory append before issuing native custody.",
    success: "Each included unit is reserved to one package. The source digest carries gather history; later native admission establishes authenticated transferable custody.",
    blocked: "Consumed, stored, reserved, mismatched or foreign units cannot enter a second package. Exchange is unavailable without the conditional backend; a local food checkpoint alone cannot establish shared source admission.",
    example: "A fruit portion and two timber units become one mixed package while retaining their separate gather sources."
  },
  "owner.offer": {
    title: "Offer a resource package", summary: "Prepare a native one-use claim for an intact package.",
    requirements: "The package remains reserved and belongs to the sender. The native subject and instrument must bind its exact complete source bytes.",
    success: "A targeted or open claim can travel through a proof card, file, link or private game chat. Its encrypted recovery copy never exposes the claim secret in world history.",
    blocked: "An unpacked, already offered or market-reserved package cannot create a competing offer.",
    example: "Send a package to a named player, or export an open claim for a future holder."
  },
  "verified-title.cancel": {
    title: "Cancel an unclaimed offer", summary: "Release an offer only after native cancellation is confirmed.",
    requirements: "The current owner cancels the exact pending native instrument. The server confirms its cancellation or expiry before releasing the source offer or listing.",
    success: "The package returns to its owner's intact available packages. Unpacking remains a separate action.",
    blocked: "An uncertain cancellation, committed transfer or market payment in progress leaves the sources reserved.",
    example: "Cancel an unclaimed proof card, then unpack the same resources back into your Satchel."
  },
  "owner.consume": {
    title: "Use admitted food", summary: "Spend one admitted food portion once.",
    requirements: "The portion belongs to the current player, has been unpacked, and has no consumption marker. The local nourishment rules still determine whether eating can succeed.",
    success: "A durable source marker prevents the eaten portion from being repackaged, transferred or eaten again.",
    blocked: "A portion held inside a package, owned by someone else, or already consumed cannot be spent.",
    example: "An imported berry portion provides nourishment while preserving its original gatherer's source history."
  },
  "owner.list": {
    title: "List a resource package", summary: "Reserve an intact native package for a fixed-price market sale.",
    requirements: "The seller holds current custody and a valid pending instrument. Its private claim bytes are encrypted and the package receives an exact listing identifier.",
    success: "Buyers can inspect the contents and price while the native claim remains withheld until payment is proven.",
    blocked: "Listed resources cannot be unpacked, consumed or transferred through another game offer.",
    example: "List one timber card or a mixed food and stone package from the same source records."
  },
  "buyer.reserve": {
    title: "Reserve a package purchase", summary: "Select one current buyer for a listing before payment.",
    requirements: "The listing is available and the buyer is distinct from the seller. A bounded reservation identifies the exact buyer and trade.",
    success: "Concurrent attempts cannot purchase the same source package; an expired reservation can be replaced until payment begins.",
    blocked: "Another live reservation or a payment already in progress prevents a competing purchase.",
    example: "Reserve a package, review its price, then commit the purchase."
  },
  "buyer.exit": {
    title: "Release a purchase reservation", summary: "Leave an unpaid reserved trade voluntarily.",
    requirements: "The recorded buyer releases the exact reservation before payment starts.",
    success: "The package remains listed for another buyer; its native instrument and seller custody are preserved.",
    blocked: "A trade with payment in progress or settled custody cannot be released as an unpaid reservation.",
    example: "Cancel your unpaid reservation when you decide to keep shopping."
  },
  "buyer.commit": {
    title: "Commit a package purchase", summary: "Bind payment and native package custody to one retryable trade.",
    requirements: "The current buyer commits a live reservation. The payment result must match the exact wallet ledger proof and listing price before the server claims the native instrument.",
    success: "One native receipt updates custody for every member. Retry uses the same payment nonce and transfer receipt.",
    blocked: "An unproven payment or uncertain outcome retains the package and trade for recovery, with no second charge or resource credit.",
    example: "Pay once for a mixed package, then unpack its exact resources after custody is admitted."
  },

  "community.adopted-procedures": {
    title: "Adopt and use community procedures", summary: "Run voluntary community participation under recorded, versioned rules.",
    requirements: "An identified player adopts the exact charter. Other members explicitly join. Every change checks the current revision, membership and the action’s specific consent and timing rules.",
    success: "Accepted allocations, notices, delegations, cases, work obligations and ratifications enter the world event history. Publication is confirmed separately through Receiz.",
    blocked: "Stale revisions, missing consent, conflicts, premature deadlines and unsupported actions are rejected. Community participation places are not physical shelter or title to land.",
    example: "A member requests a participation place. If capacity is full, the request waits in recorded order until a place becomes available."
  },
  "commons.plan": {
    title: "Start a shared project", summary: "Give a construction project a defined plan and permissions.",
    requirements: "Submit a valid project definition as an identified player. The construction rules validate the project before it enters the world.",
    success: "A project is recorded so later planning, material contributions and work can refer to it.",
    blocked: "An invalid project or unverified actor cannot establish a new project through this command.",
    example: "Create a project before placing components that belong to it. A project does not grant ownership of the surrounding Earth."
  },
  "project.plan": {
    title: "Place, dig and adjust", summary: "Shape an existing project within its planning permissions.",
    requirements: "The project must exist and permit the requested action. Placement and adjustment must satisfy their geometry and source-state checks; renovation also checks the component owner and its current revision.",
    success: "The accepted placement, excavation or adjustment becomes part of the project’s recorded state.",
    blocked: "Missing access, a conflicting placement or an outdated component revision prevents that change. Refresh the project before trying an outdated adjustment again.",
    example: "Moving an existing component needs its current revision, rather than the version you saw before another change."
  },
  "materials.contribute": {
    title: "Contribute materials", summary: "Commit available materials to a construction component or site.",
    requirements: "The target must accept the contribution. Material lots must be available to the contributor and meet the target’s material and access rules.",
    success: "The contribution is recorded against the construction target. Those materials cannot also be spent as if they were still freely available.",
    blocked: "Missing, duplicate, already consumed, stored or reserved lots can prevent a contribution. Project contributions also require the relevant permission.",
    example: "Contribute timber to a build using available inventory, then perform the required work separately."
  },
  "project.work": {
    title: "Work on a component", summary: "Advance a project through admitted construction work.",
    requirements: "Use the current component revision in a project that permits you to work. The component’s work rules determine what can progress.",
    success: "Accepted work updates the component and records the resulting construction event.",
    blocked: "A stale component or missing work permission prevents progress through that request.",
    example: "Having materials in a project does not itself authorize every visitor to change or work on its components."
  },
  "commons.observe": {
    title: "Observe and discover", summary: "Track a boss, discover an ecology site or observe a grove.",
    requirements: "The target must exist and meet the selected command’s rules. Ecology discovery checks the site’s discovery phase and that you are within its radius.",
    success: "The observation or discovery is recorded for the relevant world feature.",
    blocked: "A missing target, unsuitable phase or out-of-range discovery cannot be accepted. Different observation commands have different checks.",
    example: "Discovering an ecology site records a discovery; it does not give you exclusive ownership of the site."
  },
  "raid.participate": {
    title: "Join and contribute to a raid", summary: "Enter encounters and take part under their current participation rules.",
    requirements: "The boss and raid must match. Depending on the action, checks include admission, location, a verified companion, turn or lease state, and contribution validity.",
    success: "Accepted participation updates the encounter. Valid contributions may also advance encounter or team history under their scoring rules.",
    blocked: "A missing encounter, absent admission or invalid action cannot advance the raid. Entering a raid does not bypass later action checks.",
    example: "A visible boss marker helps you find an encounter; it is not permission to attack from any distance."
  },
  "voluntary.exit": {
    title: "Retreat from a raid", summary: "Leave an encounter through its defined retreat action.",
    requirements: "Reference an existing raid and satisfy the encounter’s retreat transition.",
    success: "The raid records the resulting participation state after retreat.",
    blocked: "A missing or incompatible encounter cannot process the requested retreat.",
    example: "Retreat changes encounter participation; it does not erase the encounter’s already recorded history."
  },
  "voluntary.associate": {
    title: "Create or join a team", summary: "Choose a team through creation, joining or an invitation.",
    requirements: "Team creation and direct joining check existing membership. Joining needs an existing team; invitation acceptance must satisfy the invitation’s player and validity rules.",
    success: "The world records the team or membership change.",
    blocked: "Existing membership, a missing team or an invalid invitation can prevent the request. An invitation alone does not complete acceptance.",
    example: "Accept an invitation addressed to your account to participate through that invitation flow."
  },
  "team.delegate": {
    title: "Organize your team", summary: "Invite players, manage roles, schedule events and assemble squads.",
    requirements: "The team must exist and the action must satisfy its role and scheduling rules. Squad assembly explicitly requires current captain or officer standing.",
    success: "The accepted invitation, role, event or squad is recorded in team state.",
    blocked: "Missing standing or invalid team, player or event data prevents the action. A title outside the team does not grant team permissions.",
    example: "A captain or officer can organize a squad only within the squad and event rules."
  },
  "claim.allege": {
    title: "Report a concern", summary: "Record a report without treating an allegation as a verdict.",
    requirements: "Supply a valid subject and reason through the reporting rules as an identified reporter.",
    success: "A report is recorded as an allegation for the world’s claims history.",
    blocked: "Invalid or duplicate reports can be rejected by the reporting rules. A report does not itself establish guilt or authorize punishment.",
    example: "Reporting an incident records the concern. Adjudication and remedies still need adopted procedures."
  },
  "stewardship.fruit": {
    title: "Care for the living world", summary: "Contribute to ecology sites and act within grove stewardship rules.",
    requirements: "Use the current site or grove state and meet the action’s contribution rules. Ecology contributions check proof format, amount, location and site phase; grove actions verify their operation and settlement.",
    success: "Accepted care updates the relevant world feature. Any reward must satisfy the applicable emission rules.",
    blocked: "An invalid contribution, mismatched operation or ineligible state prevents the requested transition. Care does not guarantee a fixed Φ payout.",
    example: "Help an active ecology site from within its radius; the recorded contribution is bounded by that site’s rules."
  },
  "verified-title.successor": {
    title: "Recognize a verified transfer", summary: "Carry an admitted custody transfer into the world’s resource records.",
    requirements: "Transfer admission binds the exact source bytes and native subject, current owner and head to a claimed native receipt through the conditional shared inventory boundary.",
    success: "The world records the successor custodian for the referenced lot or every member of an intact resource package.",
    blocked: "A local ownership claim is not a substitute for transfer authority. This command family does not independently send a wallet payment.",
    example: "A resource custody record follows the admitted transfer evidence; changing a displayed name does not transfer the resource."
  },
  "commons.harvest": {
    title: "Harvest trees and stone", summary: "Gather available resources through their current source rules.",
    requirements: "The source revision must be current. Harvesting checks position and source requirements. A supplied tool must be yours and equipped; companion assistance needs a valid mandate for the companion, profession and resource.",
    success: "The harvest records a material lot and updated source state, including tool changes where applicable. An eligible Φ award is admitted only when its emission evidence matches.",
    blocked: "An outdated source, unsuitable tool, invalid companion mandate or mismatched operation prevents the request. Reward eligibility is checked separately from the material yield.",
    example: "Approach a ready stone source with the required ability or tool. Another harvest may change the source revision before yours is admitted."
  },
  "materials.create": {
    title: "Build and craft", summary: "Turn valid material inputs and work into structures or tools.",
    requirements: "Meet the selected recipe, custody, placement and work conditions. Crafting a steward tool also requires your valid workstation within reach. Companion work needs a valid mandate when supplied.",
    success: "The admitted site, structure or tool and its material use are recorded. Eligible build rewards are checked against the actual operation and current emission state.",
    blocked: "Unavailable materials, an unsuitable position, a missing workstation or mismatched settlement can prevent creation. A preview is not a completed build.",
    example: "Gather the recipe’s materials, choose a valid placement and complete the required work to produce the improvement."
  },
  "owner.use": {
    title: "Equip tools and move materials", summary: "Use owned tools and move materials through permitted storage.",
    requirements: "The tool or material must exist and the requested use must satisfy its ownership, custody and storage rules.",
    success: "The equipped-tool selection or material storage location is updated in world state.",
    blocked: "A resource you cannot use, or an invalid storage move, cannot be admitted merely because it is visible.",
    example: "Equip an owned steward tool before supplying it to a harvest that checks the equipped tool."
  },
  "story.participate": {
    title: "Advance a world story", summary: "Contribute to chapters, trainer battles and tournament entry.",
    requirements: "The story definition must exist and the requested chapter must match. Each contribution, battle or tournament action also follows its specific story rules.",
    success: "Accepted participation updates the story’s recorded progress and associated events.",
    blocked: "A missing definition, mismatched chapter or invalid action cannot advance the story through that request.",
    example: "Follow the current chapter’s activity rather than submitting an action for a chapter the story has already left."
  }
} satisfies Record<Law, RuleDetail>;

export type ExplainedRule = RuleDetail & { id: string; commands: string[] };
