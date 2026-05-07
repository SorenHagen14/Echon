# Echon — Growth

Living doc for promoting Echon: warm-lead outreach, vertical expansion
ideas, positioning angles, and anything else that helps a pilot land or a
non-HVAC trade get on the roadmap. Update as new ideas / leads come in.

## The core pitch (steal this for any outreach)

> A potential customer calls a service business. Nobody picks up. They hang up
> and call the next one on the list. That call was the customer, and the
> business never even knew it happened.

This is the universal pain. Every blue-collar trade and every appointment-
based small business hits it. Echon is the AI receptionist that picks up
on the first ring 24/7, books the appointment, and tells the owner about
it after. The pitch isn't "AI" — it's "you stopped losing customers to
voicemail."

## Warm leads (active)

### Mobile car detailing — buddy
- **Vertical:** auto detailing
- **Why fit:** solo operator / 1-2 person shop, on the road most of the day,
  can't pick up the phone mid-detail. Classic "phone goes to voicemail and
  the customer goes to the next guy." Booking + after-hours triage maps
  cleanly from HVAC.
- **Status:** parked beta-test outreach in BACKLOG (2026-05-06).
- **Action:** message him, see if he'll run a free pilot. Capture feedback
  in `PILOT_FEEDBACK.md`. If yes → add `detailing` to `business_type`
  enum, sanity-check onboarding copy reads outside HVAC.
- **What to listen for:** does the trade-aware action plan prompt make
  sense for detailing? Are there detailing-specific service categories
  the catalog needs (full detail / interior only / paint correction /
  ceramic coating)?

### Print shops + catering — brother's SMMA clients
- **Brother runs an SMMA.** Many of his clients are print shops or
  catering companies — both are appointment / quote-driven small
  businesses where a missed call = a lost job that goes to a competitor
  the same day. Same core pain as HVAC.
- **Why fit (catering):** quote requests are time-sensitive. A catering
  inquiry that goes to voicemail at 4pm on Friday gets called by the
  next caterer 90 seconds later. Echon answers, captures event date /
  guest count / dietary needs / budget range, hands the qualified lead
  to the owner Monday morning.
- **Why fit (print shops):** quote requests with attachments
  (job specs, files) are a different shape — voice can't capture the
  artwork. But "what are your hours / can you do same-day / do you do
  large format / what's your turnaround" all answer cleanly. Possible
  hand-off pattern: AI qualifies basics, then SMS-back a link for the
  customer to upload artwork.
- **Status:** not yet contacted. Idea-stage.
- **Angle to brother:** he can white-label / resell Echon to existing
  clients as an upsell on top of his SMMA services. The SMMA already
  fills the lead funnel; Echon catches the leads the funnel produces
  when no one's at the desk. Double-dip.
- **Action:** ask brother (a) which of his current clients lose the most
  calls, (b) would he be willing to introduce one print shop + one
  catering client as pilots, (c) what would a referral / revenue-share
  arrangement look like.
- **What to learn:** every new vertical we touch needs us to confirm the
  `business_type` enum + service catalog + urgency keywords are
  reasonable. Two non-HVAC pilots from his book would be a strong
  signal on whether the product generalizes or needs per-vertical
  tuning beyond a config swap.

## Vertical expansion shortlist

In rough priority order based on conversations so far:

1. **HVAC** — launch vertical. Already shipped.
2. **Auto detailing** — warm lead, see above.
3. **Catering** — warm lead via brother's SMMA, see above.
4. **Print shops** — warm lead via brother's SMMA, see above.
5. **Plumbing / electrical / roofing** — same dynamics as HVAC, ought to
   work with minor catalog changes. Cold outreach territory.
6. **Deck / fence / landscaping** — quote-heavy, seasonal. Probably fits.
7. **Cleaning services / handymen / pest control** — appointment-based,
   solo or small-team. Likely fits.

Each vertical that lands needs (a) a `business_type` enum row, (b) a
service catalog template, (c) a pass on onboarding copy, and (d) at
least one real test call to verify the agent doesn't sound like it
thinks the caller wants a furnace tuned.

## Positioning notes

- **Don't lead with "AI."** Lead with the outcome: "Stop losing customers
  to voicemail." The AI is how, not what.
- **Owner-first language.** The buyer is a 1-15 truck owner-operator.
  They don't care about prompt engineering, transcripts, or webhooks.
  They care about: did the appointment get booked, and did I find out
  about it before my competitor did.
- **Specificity beats generality.** "Catches every after-hours emergency
  call from a customer with no heat" beats "AI receptionist for service
  businesses." Niche per-vertical landing pages > one generic page.
- **Social proof from a real shop > demo videos.** A 60-second clip of a
  pilot owner saying "this booked me three jobs last weekend I would
  have missed" is worth more than any feature list.

## Channels to think about (none active yet)

- **Warm intros from operator networks.** Brother's SMMA, buddy's
  detailing customers, any future pilot's referrals. Highest-trust
  channel for blue-collar — these owners hire people their friends used.
- **Trade subreddits + Facebook groups.** r/HVAC, r/Plumbing, contractor
  Facebook groups. Don't spam — show up with a free pilot and a real
  conversation.
- **Local trade associations.** State-level HVAC / electrical / plumbing
  associations sometimes do member-discount programs. Pilot has to be
  proven first.
- **YouTube content.** "I called 20 HVAC shops at 6pm — here's what
  happened" → pitch Echon at the end. The pain is performable on camera.

(All channels gated on first 1-3 pilot wins. Cold outreach without proof
is wasted time.)

## Open questions / things to figure out

- Pricing structure — flat monthly, per-call, per-booked-appointment, or
  hybrid? Pilots will tell us.
- White-label option for SMMA resellers (relevant if brother actually
  wants to bundle this with his service)?
- Referral program — what's the right incentive for a pilot owner to
  introduce another owner?
- Privacy / disclosure — recording-consent state laws affect what the
  agent has to say at greeting. Already partially handled in code; needs
  to be unmistakably clear in marketing too (see BACKLOG: privacy tab).
